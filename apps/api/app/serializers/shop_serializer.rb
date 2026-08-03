module ShopSerializer
  module_function

  # include_payment_info must stay false for anything reachable by public
  # discovery or by customers — opening_message/opening_message_photos are
  # only ever meant to be seen by the vendor themselves (in shop settings)
  # or read live by an order's two participants via OrderSerializer
  # (ADR 0009), never broadcast on the open shop listing. The vendor's exact
  # unit (`address`) is gated the same way, for the same reason — only
  # `building` (e.g. "Tower B") is safe to hand to every anonymous browser.
  def call(shop, include_payment_info: false)
    {
      id: shop.id,
      name: shop.name,
      slug: shop.slug,
      description: shop.description,
      contact_number: shop.contact_number,
      building: shop.building,
      fulfillment_methods: shop.fulfillment_methods,
      status: shop.status,
      accepting_orders: shop.accepting_orders,
      open: shop.open?,
      # has_images is always has_many_attached under the hood (max_count just
      # validates the ceiling), so even a single-image field like these is a
      # collection accessor — #first is "the one" photo, if any.
      profile_photo: shop.profile_photo.attached? ? PhotoSerializer.one(shop.profile_photo.first) : nil,
      cover_photo: shop.cover_photo.attached? ? PhotoSerializer.one(shop.cover_photo.first) : nil,
      # Always public, on both the listing and the shop page. average_rating
      # is nil (never 0) for an unrated shop so clients can say "no reviews
      # yet" instead of rendering a misleading zero-star score. to_f matters:
      # AVG returns a BigDecimal, which Rails would serialize as a JSON
      # *string* ("4.3"), not a number.
      average_rating: shop.ratings.average(:score)&.round(1)&.to_f,
      ratings_count: shop.ratings.count,
      # nil (not [0, 0]) when the shop has no enabled items to price, same
      # "absence over a misleading zero" convention as average_rating above.
      price_range_cents: price_range_cents(shop),
      # Completed only (not placed/cancelled/rejected) — a popularity signal,
      # not a raw order count, so an order that never actually happened
      # shouldn't count toward it.
      completed_orders_count: shop.orders.where(status: "completed").count,
      created_at: shop.created_at,
      updated_at: shop.updated_at
    }.merge(include_payment_info ? payment_info(shop) : {})
  end

  def price_range_cents(shop)
    enabled = shop.items.enabled
    return nil unless enabled.exists?

    { min: enabled.minimum(:price_cents), max: enabled.maximum(:price_cents) }
  end

  def payment_info(shop)
    {
      address: shop.address,
      opening_message: shop.opening_message,
      opening_message_photos: PhotoSerializer.list(shop.opening_message_photos)
    }
  end
end
