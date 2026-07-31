class ConversationPolicy < ApplicationPolicy
  def show?         = participant?
  def post_message? = participant?

  private

  def participant?
    order = record.order
    (user.customer_profile.present? && order.customer_profile.user_id == user.id) ||
      (user.vendor_profile.present? && order.shop.vendor_profile.user_id == user.id)
  end
end
