module Admin
  module CustomerProfileSerializer
    module_function

    def call(customer_profile)
      {
        id: customer_profile.id,
        user_id: customer_profile.user_id,
        user_email: customer_profile.user.email,
        display_name: customer_profile.display_name,
        is_resident: customer_profile.is_resident,
        willing_to_verify_residency: customer_profile.willing_to_verify_residency,
        default_address_id: customer_profile.default_address_id,
        created_at: customer_profile.created_at
      }
    end
  end
end
