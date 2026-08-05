class VendorProfile < ApplicationRecord
  belongs_to :user
  has_many :shops, dependent: :destroy
  # Private notes this vendor has written about customers. Reads of
  # VendorCustomerNote must always start here so they stay scoped to one
  # vendor — see the model for why.
  has_many :vendor_customer_notes, dependent: :destroy

  VERIFICATION_STATUSES = %w[unverified pending verified rejected].freeze

  validates :display_name, presence: true
  validates :user_id, uniqueness: true
  validates :verification_status, inclusion: { in: VERIFICATION_STATUSES }

  scope :demo, -> { joins(:user).merge(User.demo) }
  scope :real, -> { joins(:user).merge(User.real) }

  def demo?
    user.demo?
  end

  # Tier-1 cancellation-abuse restriction (Orders::CancellationAbuseCheck).
  # Presence of the timestamp is the only thing that matters here — cleared
  # by an admin action, independent of cancellation_restriction_count (which
  # is permanent and never touched by clearing).
  def restricted?
    cancellation_restricted_at.present?
  end
end
