class CustomerProfile < ApplicationRecord
  belongs_to :user
  belongs_to :default_address, class_name: "Address", optional: true
  has_many :carts, dependent: :destroy
  has_many :orders, dependent: :destroy

  RESIDENCY_VERIFICATION_STATUSES = %w[unverified pending verified rejected].freeze

  validates :display_name, presence: true
  validates :user_id, uniqueness: true
  validates :residency_verification_status, inclusion: { in: RESIDENCY_VERIFICATION_STATUSES }

  scope :demo, -> { joins(:user).merge(User.demo) }
  scope :real, -> { joins(:user).merge(User.real) }

  def demo?
    user.demo?
  end

  def residency_verified?
    residency_verification_status == "verified"
  end

  # Tier-1 cancellation-abuse restriction (Orders::CancellationAbuseCheck).
  # Presence of the timestamp is the only thing that matters here — cleared
  # by an admin action, independent of cancellation_restriction_count (which
  # is permanent and never touched by clearing).
  def restricted?
    cancellation_restricted_at.present?
  end

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
