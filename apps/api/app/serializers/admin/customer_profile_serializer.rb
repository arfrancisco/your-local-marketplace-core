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
        residency_verification_status: customer_profile.residency_verification_status,
        email_verified: customer_profile.user.email_verified?,
        mobile_verified: customer_profile.user.mobile_verified?,
        demo: customer_profile.demo?,
        default_address_id: customer_profile.default_address_id,
        cancellation_restricted_at: customer_profile.cancellation_restricted_at,
        cancellation_restriction_count: customer_profile.cancellation_restriction_count,
        created_at: customer_profile.created_at
      }
    end
  end
end
