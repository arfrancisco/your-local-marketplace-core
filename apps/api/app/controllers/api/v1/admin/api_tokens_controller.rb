module Api
  module V1
    module Admin
      class ApiTokensController < BaseController
        before_action :set_api_token, only: %i[show destroy]

        # GET /api/v1/admin/api_tokens?user_id=1
        def index
          scope = ApiToken.order(created_at: :desc)
          scope = scope.where(user_id: params[:user_id]) if params[:user_id].present?
          render json: {
            api_tokens: paginate(scope).map { |t| ::Admin::ApiTokenSerializer.call(t) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { api_token: ::Admin::ApiTokenSerializer.call(@api_token) }
        end

        # DELETE /api/v1/admin/api_tokens/:id — soft-revoke (expire now), not
        # a hard delete, so issue/last-used history survives for audit.
        def destroy
          @api_token.update!(expires_at: Time.current)
          render json: { api_token: ::Admin::ApiTokenSerializer.call(@api_token) }
        end

        private

        def set_api_token
          @api_token = ApiToken.find(params[:id])
        end
      end
    end
  end
end
