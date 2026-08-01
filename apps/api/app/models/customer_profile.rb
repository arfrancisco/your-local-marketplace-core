class CustomerProfile < ApplicationRecord
  belongs_to :user
  belongs_to :default_address, class_name: "Address", optional: true
  has_many :carts, dependent: :destroy
  has_many :orders, dependent: :destroy

  validates :display_name, presence: true
  validates :user_id, uniqueness: true

  # Claiming residency and consenting to future verification aren't
  # independently optional: agreeing to be verified is a condition of
  # claiming residency at all, not a separate free choice.
  validate :willing_to_verify_residency_required_if_resident

  private

  def willing_to_verify_residency_required_if_resident
    return unless is_resident && willing_to_verify_residency != true

    errors.add(:willing_to_verify_residency, "must be accepted to claim resident/tenant status")
  end
end
