# Real-time delivery for per-order chat (ADR 0009). Only the order's customer
# or the shop's vendor may subscribe — same ownership rule as the REST
# policies (see ConversationPolicy).
class OrderChatChannel < ApplicationCable::Channel
  def subscribed
    conversation = Conversation.find_by(id: params[:conversation_id])
    reject and return if conversation.nil? || !authorized?(conversation)

    stream_for conversation
  end

  private

  def authorized?(conversation)
    order = conversation.order
    order.customer_profile.user_id == current_user.id ||
      order.shop.vendor_profile.user_id == current_user.id
  end
end
