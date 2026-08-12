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
    #
    # "placed" is here too even though it's never reached via #call
    # (placement doesn't go through this state machine — see
    # Carts::Checkout) — kept in this same table, not a separate constant,
    # so Carts::Checkout's own placed-order system message stays worded
    # consistently with every status message that follows it, in one place
    # to update.
    SYSTEM_MESSAGE_TEXT = {
      "placed" => "Order placed.",
      "accepted" => "Order accepted by the vendor.",
      "preparing" => "Vendor is preparing the order.",
      "ready_for_pickup" => "Order is ready for pickup.",
      "out_for_delivery" => "Order is out for delivery.",
      "completed" => "Order completed.",
      "rejected" => "Order rejected by the vendor."
    }.freeze

    # How long after completion, if still unrated, RatingReminderJob posts a
    # follow-up nudge into the order's chat (see #call).
    RATING_REMINDER_DELAY = 24.hours

    # Which to_status values fire an OrderNotificationJob SMS. Owned here
    # (not by the job) so this file keeps deciding locally "which to_status
    # triggers which side effect" the same way it already does for
    # TIMESTAMP_COLUMNS/SYSTEM_MESSAGE_TEXT, rather than reaching into the
    # job's namespace for a shared constant. "placed" isn't here — it's
    # never reached via #call (see the SYSTEM_MESSAGE_TEXT comment above);
    # Carts::Checkout enqueues that one directly. rejected/cancelled/
    # preparing deliberately do not notify.
    NOTIFIABLE_STATUSES = %w[accepted ready_for_pickup out_for_delivery completed].freeze

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

      order_status_event = nil
      ActiveRecord::Base.transaction do
        # Locks the order row first so two concurrent requests for the same
        # transition (double-tap "Accept" from two tabs) can't both pass
        # can_transition_to? before either commits. lock! reloads @order
        # under the row lock, so the second request to reach here blocks
        # until the first commits, then sees the first's write and re-fails
        # can_transition_to? here — the check above alone only catches the
        # non-concurrent case.
        @order.lock!
        unless @order.can_transition_to?(@to_status)
          raise ApiError::UnprocessableEntity,
                "Cannot move an order from #{@order.status} to #{@to_status}"
        end

        from_status = @order.status
        attrs = { status: @to_status }
        timestamp_column = TIMESTAMP_COLUMNS[@to_status]
        attrs[timestamp_column] = Time.current if timestamp_column
        @order.update!(attrs)
        order_status_event = @order.order_status_events.create!(
          from_status: from_status,
          to_status: @to_status,
          actor_user: @actor_user,
          reason: @reason,
          reason_code: @reason_code
        )
        Orders::CancellationAbuseCheck.new(order: @order, actor_user: @actor_user).call if @to_status == "cancelled"
      end

      post_system_message
      RatingReminderJob.set(wait: RATING_REMINDER_DELAY).perform_later(@order.id) if @to_status == "completed"
      OrderNotificationJob.perform_later(order_status_event.id) if NOTIFIABLE_STATUSES.include?(@to_status)
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
