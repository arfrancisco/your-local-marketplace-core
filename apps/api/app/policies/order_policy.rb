class OrderPolicy < ApplicationPolicy
  def show?       = customer_owner? || vendor_owner?
  def transition? = customer_owner? || vendor_owner?
  # Only the vendor marks payment received — it's their judgment call based
  # on what they see in chat (ADR 0009), not something a customer asserts.
  def mark_paid?  = vendor_owner?

  private

  def customer_owner?
    user.customer_profile.present? && record.customer_profile.user_id == user.id
  end

  def vendor_owner?
    user.vendor_profile.present? && record.shop.vendor_profile.user_id == user.id
  end
end
