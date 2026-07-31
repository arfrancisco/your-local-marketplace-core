module Api
  module V1
    module Vendor
      # Only the list endpoint is vendor-specific — order detail/transition/
      # conversation actions are shared with the customer side via the
      # non-namespaced OrdersController/ConversationsController (see
      # config/routes.rb).
      class OrdersController < BaseController
        # GET /api/v1/vendor/orders?shop_id=:shop_id (optional)
        def index
          shops = current_vendor_profile.shops
          shops = shops.where(id: params[:shop_id]) if params[:shop_id].present?
          orders = Order.where(shop: shops).order(placed_at: :desc)
          render json: { orders: orders.map { |order| OrderSerializer.call(order) } }
        end
      end
    end
  end
end
