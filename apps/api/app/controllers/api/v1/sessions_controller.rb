module Api
  module V1
    class SessionsController < BaseController
      skip_before_action :authenticate!, only: :create

      # POST /api/v1/auth/login
      def create
        result = Auth::AuthenticateUser.new(
          email: session_params[:email],
          password: session_params[:password]
        ).call

        render json: { token: result.token, user: UserSerializer.call(result.user) }, status: :created
      end

      # POST /api/v1/auth/logout
      def destroy
        current_api_token&.destroy
        head :no_content
      end

      private

      def session_params
        params.permit(:email, :password)
      end
    end
  end
end
