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
        render json: { user: UserSerializer.call(current_user.reload) }
      end

      private

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
    end
  end
end
