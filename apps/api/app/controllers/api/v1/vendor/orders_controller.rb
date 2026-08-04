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
                        .includes(:order_items, :shop, :conversation, customer_profile: %i[user default_address])
                        .order(placed_at: :desc)
          unread = Messaging::UnreadOrders.for(orders: orders, user: current_user)
          render json: { orders: orders.map { |order| OrderSerializer.call(order, unread: unread.include?(order.id)) } }
        end
      end
    end
  end
end
