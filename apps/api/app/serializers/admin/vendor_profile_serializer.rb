module Admin
  module VendorProfileSerializer
    module_function

    def call(vendor_profile)
      {
        id: vendor_profile.id,
        user_id: vendor_profile.user_id,
        user_email: vendor_profile.user.email,
        display_name: vendor_profile.display_name,
        verification_status: vendor_profile.verification_status,
        shop_count: vendor_profile.shops.count,
        created_at: vendor_profile.created_at
      }
    end
  end
end
