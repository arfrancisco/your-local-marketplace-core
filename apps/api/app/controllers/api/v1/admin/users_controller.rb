module Api
  module V1
    module Admin
      class UsersController < BaseController
        before_action :set_user, only: %i[show suspend reactivate]

        # GET /api/v1/admin/users?status=suspended&q=juan
        def index
          scope = filter_by_demo(User.order(created_at: :desc))
          scope = scope.where(status: params[:status]) if params[:status].present?
          if params[:q].present?
            scope = scope.where("email ILIKE :q OR mobile_number ILIKE :q", q: "%#{params[:q]}%")
          end
          render json: {
            users: paginate(scope).map { |u| UserSerializer.call(u).merge(demo: u.demo?) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { user: UserSerializer.call(@user).merge(demo: @user.demo?) }
        end

        # POST /api/v1/admin/users/:id/suspend — never a hard delete; a User
        # cascade-owns too much (addresses, orders, api_tokens) to destroy.
        def suspend
          @user.update!(status: "suspended")
          render json: { user: UserSerializer.call(@user) }
        end

        # POST /api/v1/admin/users/:id/reactivate
        def reactivate
          @user.update!(status: "active")
          render json: { user: UserSerializer.call(@user) }
        end

        private

        def set_user
          @user = User.find(params[:id])
        end
      end
    end
  end
end
