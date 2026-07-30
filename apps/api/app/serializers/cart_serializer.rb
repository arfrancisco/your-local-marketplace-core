module CartSerializer
  module_function

  def call(cart)
    {
      id: cart.id,
      shop_id: cart.shop_id,
      status: cart.status,
      items: cart.cart_items.includes(:item).map { |ci| line(ci) },
      subtotal_cents: cart.subtotal_cents
    }
  end

  def line(cart_item)
    item = cart_item.item
    {
      id: cart_item.id,
      item_id: item.id,
      name: item.name,
      price_cents: item.price_cents,
      currency: item.currency,
      quantity: cart_item.quantity,
      line_total_cents: cart_item.line_total_cents
    }
  end
end
