module Api
  module V1
    # Email + mobile verification. All actions require an authenticated user; a
    # user only ever verifies their own contact details. Codes are delivered out
    # of band and confirmed here.
    class VerificationsController < BaseController
      # POST /api/v1/verifications/email
      # POST /api/v1/verifications/mobile
      def create
        Verifications::IssueChallenge.new(user: current_user, channel: channel).call
        # 202: the code has been accepted for delivery, not yet confirmed.
        render json: { message: "Verification code sent" }, status: :accepted
      end

      # POST /api/v1/verifications/email/confirm
      # POST /api/v1/verifications/mobile/confirm
      def confirm
        user = Verifications::ConfirmChallenge.new(
          user: current_user,
          channel: channel,
          code: params[:code]
        ).call

        render json: { user: UserSerializer.call(user) }, status: :ok
      end

      private

      # Set per-route (see routes.rb) so one controller serves both channels.
      def channel
        params.fetch(:channel)
      end
    end
  end
end
