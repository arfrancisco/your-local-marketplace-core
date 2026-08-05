class Address < ApplicationRecord
  belongs_to :user, optional: true

  validates :recipient_name, presence: true
  validates :building, presence: true
  # Starts with a digit, not strictly digits-only — real unit numbers in
  # this community are sometimes floor+letter (e.g. "12F"), but a value
  # with no leading digit at all ("asdfasdf") is just bad input, not a
  # real unit.
  validates :unit, format: { with: /\A\d/, message: "must start with a number" }, allow_blank: true
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
