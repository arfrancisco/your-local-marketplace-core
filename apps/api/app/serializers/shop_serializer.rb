module ShopSerializer
  module_function

  def call(shop)
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
      created_at: shop.created_at,
      updated_at: shop.updated_at
    }
  end
end
