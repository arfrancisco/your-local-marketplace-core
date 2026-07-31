module Carts
  # Converts an active cart into a real order (rest of M3, per ADR 0008).
  # Re-validates every item is still enabled before snapshotting into
  # order_items — a cart can sit for a while before checkout, so what was
  # valid when added may not be by the time the customer checks out.
  #
  # Also stands up the order's (empty) conversation. The shop's opening
  # message/QR gallery is read live off the shop whenever the order is
  # fetched (see OrderSerializer) rather than snapshotted here — it's a
  # pinned panel that always reflects current vendor settings, not a chat
  # message (ADR 0009, revised).
  class Checkout
    def initialize(cart:, fulfillment_method:, customer_note: nil)
      @cart = cart
      @fulfillment_method = fulfillment_method
      @customer_note = customer_note
    end

    def call
      raise ApiError::UnprocessableEntity, "Cart is empty" if @cart.cart_items.empty?
      unless Shop::FULFILLMENT_METHODS.include?(@fulfillment_method) &&
             @cart.shop.fulfillment_methods.include?(@fulfillment_method)
        raise ApiError::UnprocessableEntity, "Invalid fulfillment method for this shop"
      end

      unavailable = @cart.cart_items.includes(:item).reject { |ci| ci.item.enabled? }
      if unavailable.any?
        raise ApiError::UnprocessableEntity.new(
          "Some items are no longer available",
          details: { unavailable_items: unavailable.map { |ci| ci.item.name } }
        )
      end

      order = nil
      ActiveRecord::Base.transaction do
        order = build_order
        order.save!
        build_order_items(order)
        order.order_status_events.create!(from_status: nil, to_status: "placed", actor_user: @cart.customer_profile.user)
        @cart.update!(status: "converted")
        Conversation.create!(order: order)
      end
      order
    end

    private

    def build_order
      subtotal = @cart.subtotal_cents
      Order.new(
        customer_profile: @cart.customer_profile,
        shop: @cart.shop,
        cart: @cart,
        fulfillment_method: @fulfillment_method,
        status: "placed",
        subtotal_cents: subtotal,
        total_cents: subtotal,
        currency: @cart.items.first.currency,
        customer_note: @customer_note,
        placed_at: Time.current
      )
    end

    def build_order_items(order)
      @cart.cart_items.includes(:item).each do |cart_item|
        item = cart_item.item
        order.order_items.create!(
          item: item,
          item_name: item.name,
          item_description: item.description,
          unit_price_cents: item.price_cents,
          quantity: cart_item.quantity,
          line_total_cents: cart_item.line_total_cents,
          customer_note: cart_item.customer_note
        )
      end
    end
  end
end
