module Api
  module V1
    # Public: forgot-password flow. Neither action requires an existing
    # session — that's the whole point.
    class PasswordResetsController < BaseController
      skip_before_action :authenticate!, only: %i[create confirm]

      # POST /api/v1/password_resets
      def create
        Auth::RequestPasswordReset.new(email: params[:email]).call
        render json: { message: "If an account exists with that email, we've sent a reset code." },
               status: :accepted
      end

      # POST /api/v1/password_resets/confirm
      def confirm
        Auth::ResetPassword.new(
          email: params[:email],
          code: params[:code],
          new_password: params[:new_password]
        ).call

        render json: { message: "Password reset. You can now sign in with your new password." }, status: :ok
      end
    end
  end
end
