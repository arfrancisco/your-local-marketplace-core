# Posts a neutral, system-voice reminder into an order's chat if it's still
# unrated some time after completion (see Orders::TransitionStatus, which
# enqueues this). Idempotent by construction (the order.ratings.exists?
# guard), so it's safe under Sidekiq's at-least-once delivery or a manual
# re-trigger.
class RatingReminderJob < ApplicationJob
  queue_as :default

  MESSAGE_BODY = "Reminder: this order hasn't been rated yet."

  def perform(order_id)
    order = Order.find_by(id: order_id)
    return if order.nil?
    return unless order.status == "completed"
    return if order.ratings.exists?
    return if order.conversation.nil?

    Messaging::PostMessage.new(
      conversation: order.conversation,
      sender_user: nil, # no acting party — a system-timed nudge, not a
                         # status-change log line; Message#sender_user is
                         # explicitly optional for this ("nil for system
                         # messages", apps/api/app/models/message.rb)
      message_type: "system",
      body: MESSAGE_BODY
    ).call
  end
end
