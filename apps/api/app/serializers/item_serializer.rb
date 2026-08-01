module ItemSerializer
  module_function

  def call(item)
    {
      id: item.id,
      shop_id: item.shop_id,
      name: item.name,
      description: item.description,
      price_cents: item.price_cents,
      currency: item.currency,
      enabled: item.enabled,
      stock_count: item.stock_count,
      sold_out: item.sold_out?,
      position: item.position,
      tags: item.tags.map { |tag| { id: tag.id, name: tag.name, slug: tag.slug } },
      photos: PhotoSerializer.list(item.photos),
      created_at: item.created_at,
      updated_at: item.updated_at
    }
  end
end
