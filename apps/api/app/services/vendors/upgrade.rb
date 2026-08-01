module Vendors
  # Creates a vendor_profile for an already-existing, already-authenticated
  # user — the "become a vendor" upgrade path. Mirrors
  # Auth::RegisterUser's user.create_vendor_profile! call, but for a user who
  # already exists rather than as part of fresh registration.
  class Upgrade
    def initialize(user:)
      @user = user
    end

    def call
      result = EligibilityCheck.new(@user).call
      unless result.eligible?
        raise ApiError::Forbidden.new("Not eligible to become a vendor", details: { reasons: result.reasons })
      end

      @user.create_vendor_profile!(display_name: display_name)
      @user
    end

    private

    def display_name
      full_name = "#{@user.first_name} #{@user.last_name}".strip
      full_name.presence || @user.email.split("@").first
    end
  end
end
