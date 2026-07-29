module Api
  module V1
    class RegistrationsController < BaseController
      skip_before_action :authenticate!, only: :create

      # POST /api/v1/auth/register
      def create
        result = Auth::RegisterUser.new(
          email: registration_params[:email],
          password: registration_params[:password],
          mobile_number: registration_params[:mobile_number],
          display_name: registration_params[:display_name],
          roles: registration_params[:roles]
        ).call

        render json: { token: result.token, user: UserSerializer.call(result.user) }, status: :created
      end

      private

      def registration_params
        params.require(:user).permit(:email, :password, :mobile_number, :display_name, roles: [])
      end
    end
  end
end
