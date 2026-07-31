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

    def initialize(order:, to_status:, actor_user:, reason: nil)
      @order = order
      @to_status = to_status
      @actor_user = actor_user
      @reason = reason
    end

    def call
      unless @order.can_transition_to?(@to_status)
        raise ApiError::UnprocessableEntity,
              "Cannot move an order from #{@order.status} to #{@to_status}"
      end

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
          reason: @reason
        )
      end
      @order
    end
  end
end
