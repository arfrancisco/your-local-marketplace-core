class ItemPolicy < ApplicationPolicy
  def show?     = owner?
  def create?   = owner?
  def update?   = owner?
  def enable?   = owner?
  def disable?  = owner?

  private

  # An item belongs to the user who owns its shop's vendor profile.
  def owner?
    record.shop.vendor_profile.user_id == user.id
  end
end
