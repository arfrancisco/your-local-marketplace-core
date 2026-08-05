module Customers
  # Screen 3 of registration: collects the customer's real name plus their
  # first delivery address in one step, and sets it as their default.
  # First/last name are deliberately not validated at the User model level
  # (so they don't retroactively apply to unrelated saves on existing
  # accounts, e.g. seeds) — this service is the one place that requires them.
  class CompleteProfile
    Result = Struct.new(:user, :address, keyword_init: true)

    def initialize(user:, first_name:, last_name:, address_params:)
      @user = user
      @first_name = first_name.to_s.strip
      @last_name = last_name.to_s.strip
      @address_params = address_params || {}
    end

    def call
      raise ApiError::Forbidden, "No customer profile on this account" if @user.customer_profile.nil?

      validate_required_fields!

      address = nil
      ActiveRecord::Base.transaction do
        @user.update!(first_name: @first_name, last_name: @last_name)
        @user.customer_profile.update!(display_name: full_name)
        address = @user.addresses.create!(address_attributes)
        @user.customer_profile.update!(default_address: address)
      end

      Result.new(user: @user, address: address)
    end

    private

    def validate_required_fields!
      field_errors = {}
      field_errors[:first_name] = ["can't be blank"] if @first_name.blank?
      field_errors[:last_name] = ["can't be blank"] if @last_name.blank?
      return if field_errors.empty?

      raise ApiError::UnprocessableEntity.new(humanize_field_errors(field_errors), details: field_errors)
    end

    # See Auth::RegisterUser's identical helper — same reasoning: these are
    # hand-built field_errors hashes, not a real ActiveModel object, so
    # there's no errors.full_messages to lean on for free.
    def humanize_field_errors(field_errors)
      field_errors.map { |field, messages| "#{field.to_s.humanize} #{messages.first}" }.join(", ")
    end

    def full_name
      "#{@first_name} #{@last_name}".strip
    end

    def address_attributes
      {
        recipient_name: @address_params[:recipient_name].presence || full_name,
        mobile_number: @address_params[:mobile_number].presence || @user.mobile_number,
        building: @address_params[:building],
        unit: @address_params[:unit],
        street_address: @address_params[:street_address],
        city: @address_params[:city],
        notes: @address_params[:notes],
        # Delivery notes moved to the Account page (editable anytime via the
        # existing PATCH /addresses/:id), not collected at signup anymore —
        # still accepted here if a caller passes it, just no longer required
        # or sent by the registration screen 3 UI.
        delivery_instructions: @address_params[:delivery_instructions]
      }
    end
  end
end
