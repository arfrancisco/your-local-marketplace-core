module Api
  module V1
    # The signed-in user's own account. GET returns the profile; PATCH updates a
    # small set of self-editable fields (contact details and profile display
    # names). Changing email/mobile clears the corresponding verified stamp so it
    # must be re-verified.
    class MeController < BaseController
      # GET /api/v1/me
      def show
        render json: { user: UserSerializer.call(current_user) }
      end

      # PATCH /api/v1/me
      def update
        current_user.assign_attributes(user_params)
        reset_verification_stamps(current_user)
        current_user.save!

        update_profile_names
        update_default_address
        render json: { user: UserSerializer.call(current_user.reload) }
      end

      # POST /api/v1/me/vendor_profile
      # "Become a vendor" upgrade for an already-registered customer. See
      # Vendors::Upgrade / Vendors::EligibilityCheck.
      def create_vendor_profile
        Vendors::Upgrade.new(user: current_user).call
        render json: { user: UserSerializer.call(current_user.reload) }, status: :created
      end

      # POST /api/v1/me/complete_profile
      # Screen 3 of registration: first/last name + first delivery address,
      # set as default. See Customers::CompleteProfile.
      def complete_profile
        result = Customers::CompleteProfile.new(
          user: current_user,
          first_name: complete_profile_params[:first_name],
          last_name: complete_profile_params[:last_name],
          address_params: complete_profile_params[:address] || {}
        ).call

        render json: {
          user: UserSerializer.call(result.user.reload),
          address: AddressSerializer.call(result.address)
        }, status: :created
      end

      private

      def complete_profile_params
        params.permit(
          :first_name, :last_name,
          address: %i[recipient_name mobile_number building unit street_address city notes delivery_instructions]
        )
      end

      def user_params
        params.require(:user).permit(:email, :mobile_number)
      end

      def reset_verification_stamps(user)
        user.email_verified_at = nil if user.email_changed?
        user.mobile_verified_at = nil if user.mobile_number_changed?
      end

      def update_profile_names
        display_name = params.dig(:user, :display_name)
        return if display_name.blank?

        current_user.customer_profile&.update!(display_name: display_name)
        current_user.vendor_profile&.update!(display_name: display_name)
      end

      # Sets the customer's default delivery address. Scoped to the user's own
      # addresses so it can't point at someone else's; passing null clears it.
      def update_default_address
        return unless params[:user].key?(:default_address_id)

        profile = current_user.customer_profile
        return if profile.nil?

        address_id = params.dig(:user, :default_address_id)
        address = address_id.present? ? current_user.addresses.find(address_id) : nil
        profile.update!(default_address: address)
      end
    end
  end
end
