module Api
  module V1
    module Admin
      class ItemsController < BaseController
        before_action :set_item, only: %i[show update destroy]

        # GET /api/v1/admin/items?shop_id=1&q=adobo&demo=true
        def index
          scope = filter_by_demo(Item.order(created_at: :desc))
          scope = scope.where(shop_id: params[:shop_id]) if params[:shop_id].present?
          scope = scope.where("name ILIKE :q", q: "%#{params[:q]}%") if params[:q].present?
          render json: {
            items: paginate(scope).map { |i| ItemSerializer.call(i) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { item: ItemSerializer.call(@item) }
        end

        # PATCH /api/v1/admin/items/:id
        def update
          @item.update!(item_params)
          render json: { item: ItemSerializer.call(@item) }
        end

        # DELETE /api/v1/admin/items/:id
        def destroy
          @item.destroy!
          head :no_content
        end

        private

        def set_item
          @item = Item.find(params[:id])
        end

        def item_params
          params.require(:item).permit(:name, :description, :price_cents, :currency, :enabled, :stock_count, :position)
        end
      end
    end
  end
end
