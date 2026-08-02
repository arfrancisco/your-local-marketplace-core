module Admin
  module OrderStatusEventSerializer
    module_function

    def call(event)
      {
        id: event.id,
        order_id: event.order_id,
        from_status: event.from_status,
        to_status: event.to_status,
        reason: event.reason,
        actor_user_id: event.actor_user_id,
        actor_user_email: event.actor_user.email,
        created_at: event.created_at
      }
    end
  end
end
