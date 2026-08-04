module Api
  module V1
    module Admin
      # Self-service admin account management (list/create/deactivate/
      # reactivate) — after the very first AdminUser is bootstrapped via the
      # admin_users:create rake task, every subsequent one is created here.
      class AdminUsersController < BaseController
        before_action :set_admin_user, only: %i[deactivate reactivate]

        # GET /api/v1/admin/admin_users
        def index
          scope = AdminUser.order(created_at: :desc)
          render json: {
            admin_users: paginate(scope).map { |a| ::Admin::AdminUserSerializer.call(a) },
            meta: pagination_meta(scope)
          }
        end

        # POST /api/v1/admin/admin_users
        def create
          admin_user = AdminUser.create!(admin_user_params)
          render json: { admin_user: ::Admin::AdminUserSerializer.call(admin_user) }, status: :created
        end

        # POST /api/v1/admin/admin_users/:id/deactivate — never a hard
        # delete; an AdminUser is referenced by admin_audit_logs history.
        # Also immediately expires the admin's existing tokens, so revoking
        # access takes effect on their very next request, not just future
        # logins (see Admin::Authentication#authenticate_admin!).
        def deactivate
          if @admin_user == current_admin_user
            raise ApiError::UnprocessableEntity, "You cannot deactivate your own account"
          end

          @admin_user.update!(status: "suspended")
          @admin_user.admin_api_tokens.active.update_all(expires_at: Time.current)
          render json: { admin_user: ::Admin::AdminUserSerializer.call(@admin_user) }
        end

        # POST /api/v1/admin/admin_users/:id/reactivate
        def reactivate
          @admin_user.update!(status: "active")
          render json: { admin_user: ::Admin::AdminUserSerializer.call(@admin_user) }
        end

        private

        def set_admin_user
          @admin_user = AdminUser.find(params[:id])
        end

        def admin_user_params
          params.require(:admin_user).permit(:email, :password, :first_name, :last_name)
        end
      end
    end
  end
end
