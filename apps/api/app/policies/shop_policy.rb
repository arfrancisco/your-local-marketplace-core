class ShopPolicy < ApplicationPolicy
  def show?          = owner?
  def create?        = user.vendor?
  def update?        = owner?
  def open?          = owner?
  def close?         = owner?
  def manage_items?  = owner?

  private

  # A shop belongs to the user who owns its vendor profile.
  def owner?
    record.vendor_profile.user_id == user.id
  end

  class Scope < Scope
    def resolve
      scope.joins(:vendor_profile).where(vendor_profiles: { user_id: user.id })
    end
  end
end
