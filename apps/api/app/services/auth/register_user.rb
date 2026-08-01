module Auth
  # Creates a user plus the requested profile(s) and mints a first token, all in
  # one transaction. Authorization here is capability-based: a user can be a
  # customer, a vendor, or both, so registration takes a set of roles rather
  # than one exclusive role.
  #
  # Residency (is_resident/willing_to_verify_residency), Terms acceptance, and
  # mobile_number are only required for the real public registration flow —
  # deliberately enforced here in the service, not as User/CustomerProfile
  # presence validations, so they don't retroactively apply to unrelated saves
  # on existing accounts (e.g. seeds, or a login's last_signed_in_at touch).
  class RegisterUser
    Result = Struct.new(:user, :token, keyword_init: true)
    ROLES = %w[customer vendor].freeze
    CURRENT_TERMS_VERSION = "2026-08-01".freeze

    def initialize(email:, password:, display_name: nil, mobile_number: nil, roles: nil,
                    is_resident: nil, willing_to_verify_residency: nil, terms_accepted: nil,
                    email_marketing_opt_in: nil, sms_marketing_opt_in: nil)
      @email = email
      @password = password
      @mobile_number = mobile_number
      @display_name = display_name
      @roles = normalize_roles(roles)
      @is_resident = cast_bool(is_resident)
      @willing_to_verify_residency = cast_bool(willing_to_verify_residency)
      @terms_accepted = cast_bool(terms_accepted)
      @email_marketing_opt_in = cast_bool(email_marketing_opt_in) || false
      @sms_marketing_opt_in = cast_bool(sms_marketing_opt_in) || false
    end

    def call
      validate_required_fields!

      user = nil
      ActiveRecord::Base.transaction do
        user = create_user!
        display_name = @display_name.presence || default_display_name(user)
        if @roles.include?("customer")
          user.create_customer_profile!(
            display_name: display_name,
            is_resident: @is_resident,
            willing_to_verify_residency: @is_resident ? @willing_to_verify_residency : nil
          )
        end
        user.create_vendor_profile!(display_name: display_name) if @roles.include?("vendor")
      end

      _record, raw = ApiToken.issue!(user)
      Result.new(user: user, token: raw)
    end

    private

    def validate_required_fields!
      field_errors = {}
      field_errors[:mobile_number] = ["can't be blank"] if @mobile_number.blank?
      field_errors[:terms_accepted] = ["must be accepted"] unless @terms_accepted == true

      if @roles.include?("customer")
        field_errors[:is_resident] = ["must be answered"] if @is_resident.nil?
        if @is_resident && @willing_to_verify_residency != true
          field_errors[:willing_to_verify_residency] = ["must be accepted to claim resident/tenant status"]
        end
      end

      return if field_errors.empty?

      raise ApiError::UnprocessableEntity.new("Validation failed", details: field_errors)
    end

    def create_user!
      User.create!(
        email: @email,
        mobile_number: @mobile_number,
        password: @password,
        terms_accepted_at: Time.current,
        terms_version: CURRENT_TERMS_VERSION,
        email_marketing_opt_in: @email_marketing_opt_in,
        sms_marketing_opt_in: @sms_marketing_opt_in
      )
    rescue ActiveRecord::RecordInvalid => e
      if e.record.errors.of_kind?(:email, :taken)
        raise ApiError::Conflict.new("An account with this email already exists.", code: "email_taken")
      end

      raise
    end

    def normalize_roles(roles)
      selected = Array(roles).map(&:to_s) & ROLES
      selected.presence || %w[customer]
    end

    def default_display_name(user)
      user.email.split("@").first
    end

    def cast_bool(value)
      ActiveModel::Type::Boolean.new.cast(value)
    end
  end
end
