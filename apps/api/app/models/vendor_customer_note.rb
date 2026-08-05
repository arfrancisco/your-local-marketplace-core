# A vendor's private note about a customer they have dealt with, e.g.
# "no-showed for pickup". Deliberately NOT a rating: it is never public,
# never shown to the customer, and never visible to another vendor even
# when that vendor has served the same customer.
#
# There is no model-level "visibility" flag doing that work. Privacy comes
# entirely from every read being scoped through vendor_profile (see
# Api::V1::Vendor::CustomerNotesController) — so any new query path must
# start from a vendor_profile, never from VendorCustomerNote directly.
class VendorCustomerNote < ApplicationRecord
  belongs_to :vendor_profile
  belongs_to :customer_profile
  belongs_to :order, optional: true

  validates :note, presence: true

  scope :demo, -> { where(vendor_profile: VendorProfile.demo).or(where(customer_profile: CustomerProfile.demo)) }
  scope :real, -> { where(vendor_profile: VendorProfile.real).where(customer_profile: CustomerProfile.real) }

  def demo?
    vendor_profile.demo? || customer_profile.demo?
  end
end
