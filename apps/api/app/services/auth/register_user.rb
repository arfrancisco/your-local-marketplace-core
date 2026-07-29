module Auth
  # Creates a user plus the requested profile(s) and mints a first token, all in
  # one transaction. Authorization here is capability-based: a user can be a
  # customer, a vendor, or both, so registration takes a set of roles rather
  # than one exclusive role.
  class RegisterUser
    Result = Struct.new(:user, :token, keyword_init: true)
    ROLES = %w[customer vendor].freeze

    def initialize(email:, password:, display_name: nil, mobile_number: nil, roles: nil)
      @email = email
      @password = password
      @mobile_number = mobile_number
      @display_name = display_name
      @roles = normalize_roles(roles)
    end

    def call
      user = nil
      ActiveRecord::Base.transaction do
        user = User.create!(email: @email, mobile_number: @mobile_number, password: @password)
        display_name = @display_name.presence || default_display_name(user)
        user.create_customer_profile!(display_name: display_name) if @roles.include?("customer")
        user.create_vendor_profile!(display_name: display_name) if @roles.include?("vendor")
      end

      _record, raw = ApiToken.issue!(user)
      Result.new(user: user, token: raw)
    end

    private

    def normalize_roles(roles)
      selected = Array(roles).map(&:to_s) & ROLES
      selected.presence || %w[customer]
    end

    def default_display_name(user)
      user.email.split("@").first
    end
  end
end
