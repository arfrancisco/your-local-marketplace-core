module ShopSerializer
  module_function

  # include_payment_info must stay false for anything reachable by public
  # discovery or by customers — opening_message/opening_message_photos are
  # only ever meant to be seen by the vendor themselves (in shop settings)
  # or read live by an order's two participants via OrderSerializer
  # (ADR 0009), never broadcast on the open shop listing.
  def call(shop, include_payment_info: false)
    {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      description: shop.description,
      contact_number: shop.contact_number,
      address: shop.address,
      fulfillment_methods: shop.fulfillment_methods,
      status: shop.status,
      accepting_orders: shop.accepting_orders,
      open: shop.open?,
      photos: PhotoSerializer.list(shop.photos),
      # Always public, on both the listing and the shop page. average_rating
      # is nil (never 0) for an unrated shop so clients can say "no reviews
      # yet" instead of rendering a misleading zero-star score. to_f matters:
      # AVG returns a BigDecimal, which Rails would serialize as a JSON
      # *string* ("4.3"), not a number.
      average_rating: shop.ratings.average(:score)&.round(1)&.to_f,
      ratings_count: shop.ratings.count,
      created_at: shop.created_at,
      updated_at: shop.updated_at
    }.merge(include_payment_info ? payment_info(shop) : {})
  end

  def payment_info(shop)
    {
      opening_message: shop.opening_message,
      opening_message_photos: PhotoSerializer.list(shop.opening_message_photos)
    }
  end
end
