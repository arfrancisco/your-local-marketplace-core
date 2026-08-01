class Address < ApplicationRecord
  belongs_to :user, optional: true

  validates :recipient_name, presence: true
  validates :building, presence: true
  validate :unit_required_for_residents

  private

  # A resident/tenant's precise unit matters for a short-distance handoff; a
  # non-resident customer (e.g. ordering for pickup) gets a simpler address
  # without this requirement.
  def unit_required_for_residents
    return unless user&.customer_profile&.is_resident
    return if unit.present?

    errors.add(:unit, "can't be blank for residents/tenants")
  end
end
