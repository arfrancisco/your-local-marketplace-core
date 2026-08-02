module Api
  module V1
    module Admin
      class CartsController < BaseController
        before_action :set_cart, only: %i[show]

        # GET /api/v1/admin/carts?status=active
        def index
          scope = Cart.order(created_at: :desc)
          scope = scope.where(status: params[:status]) if params[:status].present?
          render json: { carts: paginate(scope).map { |c| CartSerializer.call(c) }, meta: pagination_meta(scope) }
        end

        def show
          render json: { cart: CartSerializer.call(@cart) }
        end

        private

        def set_cart
          @cart = Cart.find(params[:id])
        end
      end
    end
  end
end
