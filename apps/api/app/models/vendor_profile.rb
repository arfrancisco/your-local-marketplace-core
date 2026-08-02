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
end
