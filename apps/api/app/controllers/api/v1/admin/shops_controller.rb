module Api
  module V1
    module Admin
      class ShopsController < BaseController
        before_action :set_shop, only: %i[show update destroy]

        # GET /api/v1/admin/shops?status=suspended&q=pizza
        def index
          scope = Shop.order(created_at: :desc)
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where("name ILIKE :q", q: "%#{params[:q]}%") if params[:q].present?
          render json: {
            shops: paginate(scope).map { |s| ShopSerializer.call(s, include_payment_info: true) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { shop: ShopSerializer.call(@shop, include_payment_info: true) }
        end

        # PATCH /api/v1/admin/shops/:id
        def update
          @shop.update!(shop_params)
          render json: { shop: ShopSerializer.call(@shop, include_payment_info: true) }
        end

        # DELETE /api/v1/admin/shops/:id
        def destroy
          @shop.destroy!
          head :no_content
        end

        private

        def set_shop
          @shop = Shop.find(params[:id])
        end

        def shop_params
          params.require(:shop).permit(:name, :description, :status, :accepting_orders, :contact_number, :address)
        end
      end
    end
  end
end
