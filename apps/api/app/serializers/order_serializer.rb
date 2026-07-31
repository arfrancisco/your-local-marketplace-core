module OrderSerializer
  module_function

  def call(order)
    {
      id: order.id,
      public_reference: order.public_reference,
      shop_id: order.shop_id,
      status: order.status,
      can_transition_to: Order::TRANSITIONS.fetch(order.status, []),
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
      conversation_id: order.conversation&.id
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
