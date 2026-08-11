module Carts
  # Converts an active cart into a real order (rest of M3, per ADR 0008).
  # Re-validates every item is still enabled and in stock before
  # snapshotting into order_items — a cart can sit for a while before
  # checkout, so what was valid when added may not be by the time the
  # customer checks out.
  #
  # Also stands up the order's (empty) conversation. The shop's opening
  # message/QR gallery is read live off the shop whenever the order is
  # fetched (see OrderSerializer) rather than snapshotted here — it's a
  # pinned panel that always reflects current vendor settings, not a chat
  # message (ADR 0009, revised).
  class Checkout
    # Hard cap on how many non-terminal orders one customer can have open at
    # once (see Order.in_flight). A structural fix, not a resettable time
    # window — see the in-flight check in #call.
    MAX_IN_FLIGHT_ORDERS = 3

    def initialize(cart:, fulfillment_method:, customer_note: nil)
      @cart = cart
      @fulfillment_method = fulfillment_method
      @customer_note = customer_note
    end

    def call
      unless verified_customer?
        raise ApiError.new(
          "Please verify your mobile number before placing an order. Check your text messages for the code we sent when you registered, or verify from your Account page.",
          code: "mobile_not_verified", status: :forbidden
        )
      end

      if @cart.customer_profile.restricted?
        raise ApiError.new(
          "Your account is temporarily restricted from placing orders due to repeated cancellations. " \
          "Contact team.kapitmarket@gmail.com to request a review.",
          code: "cancellation_restricted", status: :forbidden
        )
      end

      # Structural abuse/cost control: nothing else bounds how many orders
      # (and therefore how many order-lifecycle SMS) a single account can
      # generate — Item#sold_out? returns false whenever stock_count is nil,
      # and checkout itself has no throttle. This stops the abuse at its
      # source rather than just slowing it down with a resettable time
      # window; also reasonable product hygiene independent of SMS.
      if @cart.customer_profile.orders.in_flight.count >= MAX_IN_FLIGHT_ORDERS
        raise ApiError.new(
          "You have 3 orders in progress — let one finish or cancel it before placing another.",
          code: "too_many_in_flight_orders", status: :forbidden
        )
      end

      raise ApiError::UnprocessableEntity, "Cart is empty" if @cart.cart_items.empty?
      unless Shop::FULFILLMENT_METHODS.include?(@fulfillment_method) &&
             @cart.shop.fulfillment_methods.include?(@fulfillment_method)
        raise ApiError::UnprocessableEntity, "Invalid fulfillment method for this shop"
      end

      # Stock can drop to zero between adding to cart and checking out, same
      # as an item being disabled or archived — re-check all three right
      # before placing the order, not just at add-to-cart time.
      unavailable = @cart.cart_items.includes(:item).reject { |ci| ci.item.enabled? && !ci.item.sold_out? && !ci.item.archived? }
      if unavailable.any?
        raise ApiError::UnprocessableEntity.new(
          "Some items are no longer available",
          details: { unavailable_items: unavailable.map { |ci| ci.item.name } }
        )
      end

      order = nil
      conversation = nil
      ActiveRecord::Base.transaction do
        order = build_order
        order.save!
        build_order_items(order)
        order.order_status_events.create!(from_status: nil, to_status: "placed", actor_user: @cart.customer_profile.user)
        @cart.update!(status: "converted")
        conversation = Conversation.create!(order: order)
      end
      post_placed_message(conversation)
      OrderNotificationJob.perform_later(order.order_status_events.find_by(to_status: "placed").id)
      order
    end

    private

    # Registration now requires a non-skippable mobile OTP step (see
    # VerifyMobilePage), so mobile is the only channel that should satisfy
    # checkout for anyone who registered after that requirement went live.
    # The email fallback exists only for accounts that predate it — they were
    # auto-issued an email challenge instead and would otherwise be locked
    # out of checkout with no action of their own. Without this cutover, a
    # brand-new registrant could dodge the "mandatory" mobile step entirely
    # by verifying email from the Account page instead (a real, working flow
    # kept for the become-a-vendor path) — accepting that here defeats the
    # whole reason mobile became mandatory in the first place.
    MOBILE_VERIFICATION_MANDATORY_SINCE = Time.zone.parse("2026-08-08 00:00:00 +0800").freeze

    def verified_customer?
      user = @cart.customer_profile.user
      return true if user.mobile_verified?

      user.email_verified? && user.created_at < MOBILE_VERIFICATION_MANDATORY_SINCE
    end

    # Mirrors Orders::TransitionStatus#post_system_message so the chat reads
    # as a full log of the order from the moment it exists, not just from
    # "accepted" onward — and so the vendor gets the usual unread-message
    # flag (Messaging::UnreadOrders) the instant an order comes in, the same
    # as any later status change. sender_user is the customer (the actor for
    # this "transition") so the vendor, not the customer, sees it as unread.
    def post_placed_message(conversation)
      Messaging::PostMessage.new(
        conversation: conversation,
        sender_user: @cart.customer_profile.user,
        message_type: "system",
        body: Orders::TransitionStatus::SYSTEM_MESSAGE_TEXT.fetch("placed")
      ).call
    end

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
