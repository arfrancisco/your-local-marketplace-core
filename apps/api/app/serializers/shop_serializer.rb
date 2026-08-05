module ShopSerializer
  module_function

  # include_payment_info must stay false for anything reachable by public
  # discovery or by customers — opening_message/opening_message_photos are
  # only ever meant to be seen by the vendor themselves (in shop settings)
  # or read live by an order's two participants via OrderSerializer
  # (ADR 0009), never broadcast on the open shop listing. The vendor's exact
  # unit (`address`) is gated the same way, for the same reason — only
  # `building` (e.g. "Tower B") is safe to hand to every anonymous browser.
  # completed_orders_count: pass a precomputed value when serializing a list
  # (see ShopsController#index, which computes it as one grouped query instead
  # of a COUNT per shop) — falls back to a live query for single-shop callers
  # where that would be overkill.
  def call(shop, include_payment_info: false, completed_orders_count: nil)
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
      # yet" instead of rendering a misleading zero-star score. Computed from
      # the loaded #ratings array (not .average/.count SQL aggregates) so a
      # preloaded association is reused instead of firing two more queries
      # per shop — a neighbourhood shop's review list is short by
      # construction, so summing in Ruby is cheap either way.
      average_rating: average_rating(shop),
      ratings_count: shop_ratings(shop).size,
      # nil (not [0, 0]) when the shop has no enabled items to price, same
      # "absence over a misleading zero" convention as average_rating above.
      price_range_cents: price_range_cents(shop),
      # Completed only (not placed/cancelled/rejected) — a popularity signal,
      # not a raw order count, so an order that never actually happened
      # shouldn't count toward it.
      completed_orders_count: completed_orders_count || shop.orders.where(status: "completed").count,
      # Public on purpose (unlike the admin-only fields above): a real
      # customer browsing must be able to tell a seeded demo shop from a
      # real neighbor's shop, since placing an order against a demo shop
      # looks identical to a real one but is never actually fulfilled.
      demo: shop.demo?,
      # A binary signal only — the intermediate workflow states (pending,
      # rejected) stay admin-only (see Api::V1::Admin::ShopsController's
      # vendor_verification_status), a customer only ever needs to know
      # "verified or not."
      verified: shop.vendor_profile.verification_status == "verified",
      created_at: shop.created_at,
      updated_at: shop.updated_at
    }.merge(include_payment_info ? payment_info(shop) : {})
  end

  def shop_ratings(shop)
    shop.ratings.to_a
  end

  def average_rating(shop)
    ratings = shop_ratings(shop)
    return nil if ratings.empty?

    (ratings.sum(&:score).to_f / ratings.size).round(1)
  end

  # Filters the loaded #items array in Ruby (mirrors Item.enabled) instead of
  # running .exists?/.minimum/.maximum against the DB, so a preloaded
  # association is reused instead of firing three more queries per shop.
  def price_range_cents(shop)
    enabled = shop.items.to_a.select { |item| item.enabled? && !item.archived? }
    return nil if enabled.empty?

    prices = enabled.map(&:price_cents)
    { min: prices.min, max: prices.max }
  end

  def payment_info(shop)
    {
      address: shop.address,
      opening_message: shop.opening_message,
      opening_message_photos: PhotoSerializer.list(shop.opening_message_photos)
    }
  end
end
