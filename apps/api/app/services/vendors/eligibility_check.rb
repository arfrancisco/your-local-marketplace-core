module Vendors
  # Single source of truth for "can this user become a vendor" — reused both
  # by Vendors::Upgrade (to reject) and by serialization (to show a customer
  # what's missing), so frontend and backend logic can't drift apart.
  #
  # Self-reported data only, deliberately: an admin residency-verification
  # queue does exist now (CustomerProfile#residency_verification_status),
  # but gating vendor eligibility on it would block signup on manual review
  # backlog. is_resident + willing_to_verify_residency (which, per the
  # registration flow's consent-checkbox design, can only ever be true
  # together) stays the practical bar here.
  class EligibilityCheck
    Result = Struct.new(:eligible, :reasons, keyword_init: true) do
      def eligible?
        eligible
      end
    end

    def initialize(user)
      @user = user
    end

    def call
      reasons = []
      reasons << "already_vendor" if @user.vendor_profile.present?
      reasons << "not_resident" unless resident?
      reasons << "not_willing_to_verify" if resident? && !willing_to_verify?
      reasons << "email_not_verified" if require_email_verification? && !@user.email_verified?

      Result.new(eligible: reasons.empty?, reasons: reasons)
    end

    private

    # Beta-launch toggle: email/mobile verification delivery isn't reliable
    # yet (Semaphore SMS sender-name approval pending, see
    # docs/open-decisions.md), so this is temporarily off to let beta users
    # sign up and become vendors with zero verification friction. Flip
    # SKIP_VERIFICATION off (or unset it) to restore the requirement.
    def require_email_verification?
      ENV["SKIP_VERIFICATION"] != "true"
    end

    def resident?
      @user.customer_profile&.is_resident == true
    end

    def willing_to_verify?
      @user.customer_profile&.willing_to_verify_residency == true
    end
  end
end
