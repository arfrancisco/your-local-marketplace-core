class VendorProfile < ApplicationRecord
  belongs_to :user

  VERIFICATION_STATUSES = %w[unverified pending verified rejected].freeze

  validates :display_name, presence: true
  validates :user_id, uniqueness: true
  validates :verification_status, inclusion: { in: VERIFICATION_STATUSES }
end
