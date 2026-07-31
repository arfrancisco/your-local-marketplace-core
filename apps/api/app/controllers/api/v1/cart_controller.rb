module Api
  module V1
    # The current customer's cart, scoped to one shop at a time (ADR 0008).
    # Requires a customer profile; a vendor-only user gets a clear 403 rather
    # than a confusing empty cart.
    class CartController < BaseController
      before_action :require_customer_profile
      before_action :set_shop, only: %i[show add_item]
      before_action :set_cart_item, only: %i[update_item remove_item]
      before_action :set_checkout_cart, only: %i[checkout]

      # GET /api/v1/cart?shop_id=:shop_id
      def show
        cart = customer_profile.carts.active.find_by(shop: @shop)
        render json: { cart: cart && CartSerializer.call(cart) }
      end

      # POST /api/v1/cart/items (shop_id, item_id, quantity)
      def add_item
        item = @shop.items.find(cart_item_params[:item_id])
        cart = Carts::AddItem.new(
          customer_profile: customer_profile, shop: @shop, item: item,
          quantity: cart_item_params[:quantity] || 1
        ).call
        render json: { cart: CartSerializer.call(cart) }, status: :created
      end

      # PATCH /api/v1/cart/items/:id (quantity)
      def update_item
        quantity = params.require(:quantity).to_i
        raise ApiError::UnprocessableEntity, "Quantity must be positive" unless quantity.positive?

        @cart_item.update!(quantity: quantity)
        render json: { cart: CartSerializer.call(@cart_item.cart.reload) }
      end

      # DELETE /api/v1/cart/items/:id
      def remove_item
        cart = @cart_item.cart
        @cart_item.destroy!
        render json: { cart: CartSerializer.call(cart.reload) }
      end

      # POST /api/v1/cart/checkout (shop_id, fulfillment_method, customer_note)
      def checkout
        order = Carts::Checkout.new(
          cart: @checkout_cart,
          fulfillment_method: params.require(:fulfillment_method),
          customer_note: params[:customer_note]
        ).call
        render json: { order: OrderSerializer.call(order) }, status: :created
      end

      private

      def customer_profile
        current_user.customer_profile
      end

      def require_customer_profile
        raise ApiError::Forbidden, "A customer profile is required for this action" if customer_profile.nil?
      end

      def set_shop
        shop_id = params[:shop_id] || cart_item_params[:shop_id]
        @shop = Shop.listed.find(shop_id)
      end

      def set_checkout_cart
        shop = Shop.listed.find(params.require(:shop_id))
        @checkout_cart = customer_profile.carts.active.find_by!(shop: shop)
      end

      # Scoped through the customer's own carts, so another customer's cart_item
      # id simply 404s rather than leaking whether it exists.
      def set_cart_item
        @cart_item = CartItem.joins(:cart).where(carts: { customer_profile_id: customer_profile.id }).find(params[:id])
      end

      def cart_item_params
        params.permit(:shop_id, :item_id, :quantity)
      end
    end
  end
end
