module Orders
  # The only way an order's status ever changes (ADR 0003/0009) — always an
  # explicit call triggered by a button click, never inferred from chat.
  # Which actor may call which transition is enforced by the controller's
  # Pundit check (OrderPolicy), not here; this only enforces the state
  # machine itself (Order::TRANSITIONS).
  class TransitionStatus
    TIMESTAMP_COLUMNS = {
      "accepted" => :accepted_at,
      "completed" => :completed_at,
      "cancelled" => :cancelled_at
    }.freeze

    # Short, neutral log lines posted to the order's chat as a `system`
    # message whenever status changes — so the chat reads as a full log of
    # the order, not just a side conversation (status itself still only
    # ever changes via these explicit transitions, never inferred from chat
    # — this just mirrors the change into the thread after the fact).
    # "cancelled" is intentionally absent here — it's built dynamically in
    # cancellation_message, since it always carries a reason.
    SYSTEM_MESSAGE_TEXT = {
      "accepted" => "Order accepted by the vendor.",
      "preparing" => "Vendor is preparing the order.",
      "ready_for_pickup" => "Order is ready for pickup.",
      "out_for_delivery" => "Order is out for delivery.",
      "completed" => "Order completed.",
      "rejected" => "Order rejected by the vendor."
    }.freeze

    def initialize(order:, to_status:, actor_user:, reason: nil, reason_code: nil)
      @order = order
      @to_status = to_status
      @actor_user = actor_user
      @reason = reason
      @reason_code = reason_code
    end

    def call
      unless @order.can_transition_to?(@to_status)
        raise ApiError::UnprocessableEntity,
              "Cannot move an order from #{@order.status} to #{@to_status}"
      end

      validate_cancellation_reason! if @to_status == "cancelled"

      ActiveRecord::Base.transaction do
        from_status = @order.status
        attrs = { status: @to_status }
        timestamp_column = TIMESTAMP_COLUMNS[@to_status]
        attrs[timestamp_column] = Time.current if timestamp_column
        @order.update!(attrs)
        @order.order_status_events.create!(
          from_status: from_status,
          to_status: @to_status,
          actor_user: @actor_user,
          reason: @reason,
          reason_code: @reason_code
        )
        Orders::CancellationAbuseCheck.new(order: @order, actor_user: @actor_user).call if @to_status == "cancelled"
      end

      post_system_message
      @order
    end

    private

    # A cancellation requires picking a reason from the acting party's own
    # list (customer and vendor cancel for different kinds of reasons), with
    # free text required as well when the code is "other" — real data on why
    # cancellations happen, instead of none.
    def validate_cancellation_reason!
      unless @reason_code.present? && reason_options.key?(@reason_code)
        raise ApiError::UnprocessableEntity, "A cancellation reason is required"
      end
      if @reason_code == "other" && @reason.blank?
        raise ApiError::UnprocessableEntity, "Please describe the reason for cancelling"
      end
    end

    def customer_actor?
      @order.customer_profile.user_id == @actor_user.id
    end

    def reason_options
      customer_actor? ? Order::CUSTOMER_CANCELLATION_REASONS : Order::VENDOR_CANCELLATION_REASONS
    end

    def post_system_message
      Messaging::PostMessage.new(
        conversation: @order.conversation,
        sender_user: @actor_user,
        message_type: "system",
        body: @to_status == "cancelled" ? cancellation_message : SYSTEM_MESSAGE_TEXT.fetch(@to_status, "Order status changed to #{@to_status}.")
      ).call
    end

    def cancellation_message
      by = customer_actor? ? "the customer" : "the vendor"
      detail = @reason_code == "other" ? @reason : reason_options.fetch(@reason_code, @reason_code)
      "Order cancelled by #{by}: #{detail}."
    end
  end
end
