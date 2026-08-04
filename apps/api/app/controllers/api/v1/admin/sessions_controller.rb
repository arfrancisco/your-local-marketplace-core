module Api
  module V1
    module Admin
      class SessionsController < BaseController
        skip_before_action :authenticate_admin!, only: :create

        # POST /api/v1/admin/auth/login
        def create
          result = Auth::AuthenticateAdminUser.new(
            email: session_params[:email],
            password: session_params[:password]
          ).call

          render json: { token: result.token, admin_user: ::Admin::AdminUserSerializer.call(result.admin_user) },
                 status: :created
        end

        # POST /api/v1/admin/auth/logout
        def destroy
          current_admin_api_token&.destroy
          head :no_content
        end

        private

        def session_params
          params.permit(:email, :password)
        end
      end
    end
  end
end
