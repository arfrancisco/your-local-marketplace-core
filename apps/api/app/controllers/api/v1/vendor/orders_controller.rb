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
          orders = Order.where(shop: shops)
                        .includes(:order_items, :shop, :ratings, :conversation, customer_profile: %i[user default_address])
                        .order(placed_at: :desc)
          unread = Messaging::UnreadOrders.for(orders: orders, user: current_user)
          # Every order here belongs to the vendor's one shop (Shop enforces
          # vendor_profile_id uniqueness) — compute its aggregate/photo data
          # once instead of once per order via OrderSerializer's default.
          shop = shops.first
          shop_context = shop && OrderSerializer.build_shop_context(shop)
          render json: {
            orders: orders.map { |order| OrderSerializer.call(order, unread: unread.include?(order.id), shop_context: shop_context) }
          }
        end
      end
    end
  end
end
