module OrderSerializer
  module_function

  # shop_context lets a caller iterating many orders for the *same* shop
  # (vendor's own order list — a vendor has exactly one shop) precompute
  # these once and pass them in, instead of every order re-running the same
  # ratings aggregate/attachment lookup. Callers whose orders span different
  # shops (customer, admin) omit it and get the original per-order behavior.
  def call(order, unread: false, shop_context: nil)
    shop_context ||= build_shop_context(order.shop)
    {
      id: order.id,
      public_reference: order.public_reference,
      shop_id: order.shop_id,
      shop_name: order.shop.name,
      # Building only, never the vendor's exact unit (shop.address) — same
      # public/private split as ShopSerializer's own building/address gate,
      # for the vendor's safety (many vendors sell out of their own unit).
      shop_building: order.shop.building,
      # Same fields as ShopSerializer's public (non-payment-info) payload —
      # all already safe for any anonymous browser, so no less safe here.
      shop_profile_photo: shop_context[:profile_photo],
      shop_average_rating: shop_context[:average_rating],
      shop_ratings_count: shop_context[:ratings_count],
      # Needed by the vendor's private customer-notes UI to look up prior
      # notes about this customer. Safe on the shared payload: this endpoint
      # is already gated to the order's two participants, so the customer
      # only ever sees their own id and the vendor only sees the id of a
      # customer they are actively serving.
      customer_profile_id: order.customer_profile_id,
      # Customer identity/logistics info — deliberately NOT snapshotted, same
      # reasoning as opening_message above: this is contextual info about a
      # person, not a term of the sale (order_items is where snapshotting
      # matters). A customer has exactly one address record (editing it in
      # place if they move), so there's nothing to snapshot in the first
      # place — see Carts::Checkout, which never collects a separate address.
      customer_name: customer_name(order.customer_profile),
      customer_is_resident: order.customer_profile.is_resident,
      customer_building: order.customer_profile.default_address&.building,
      customer_unit: order.customer_profile.default_address&.unit,
      status: order.status,
      can_transition_to: order.available_transitions,
      fulfillment_method: order.fulfillment_method,
      subtotal_cents: order.subtotal_cents,
      total_cents: order.total_cents,
      currency: order.currency,
      payment_status: order.payment_status,
      customer_note: order.customer_note,
      vendor_note: order.vendor_note,
      items: order.order_items.map { |oi| line(oi) },
      # Read live off the shop, not snapshotted at checkout — a pinned panel
      # that always reflects current vendor settings (ADR 0009, revised).
      # Safe here even though the public shop listing must never show this
      # (see ShopSerializer's include_payment_info) — OrdersController
      # already gates every order to just its two participants.
      opening_message: order.shop.opening_message,
      opening_message_photos: PhotoSerializer.list(order.shop.opening_message_photos),
      placed_at: order.placed_at,
      accepted_at: order.accepted_at,
      completed_at: order.completed_at,
      cancelled_at: order.cancelled_at,
      conversation_id: order.conversation&.id,
      has_unread_messages: unread,
      # Only the customer may rate, and only once, so an order has at most one
      # rating this phase — .first is the whole set, not a shortcut.
      rating: order.ratings.first && RatingSerializer.call(order.ratings.first)
    }
  end

  def customer_name(customer_profile)
    customer_profile.display_name.presence || customer_profile.user.email
  end

  def build_shop_context(shop)
    {
      profile_photo: shop.profile_photo.attached? ? PhotoSerializer.one(shop.profile_photo.first) : nil,
      average_rating: shop.ratings.average(:score)&.round(1)&.to_f,
      ratings_count: shop.ratings.count
    }
  end

  def line(order_item)
    {
      id: order_item.id,
      item_id: order_item.item_id,
      name: order_item.item_name,
      unit_price_cents: order_item.unit_price_cents,
      quantity: order_item.quantity,
      line_total_cents: order_item.line_total_cents
    }
  end
end
