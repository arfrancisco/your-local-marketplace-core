# Plain serializers (no gem) keep the JSON contract explicit and in one place.
# Never leak password_digest or token digests.
module UserSerializer
  module_function

  def call(user)
    {
      id: user.id,
      email: user.email,
      mobile_number: user.mobile_number,
      status: user.status,
      email_verified: user.email_verified?,
      mobile_verified: user.mobile_verified?,
      last_signed_in_at: user.last_signed_in_at,
      customer_profile: user.customer_profile && profile(user.customer_profile),
      vendor_profile: user.vendor_profile && vendor_profile(user.vendor_profile),
      created_at: user.created_at
    }
  end

  def profile(profile)
    {
      id: profile.id,
      display_name: profile.display_name,
      default_address_id: profile.default_address_id
    }
  end

  def vendor_profile(profile)
    {
      id: profile.id,
      display_name: profile.display_name,
      verification_status: profile.verification_status
    }
  end
end
