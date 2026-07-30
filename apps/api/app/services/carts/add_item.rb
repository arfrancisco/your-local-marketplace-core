module Carts
  # Adds an item to the customer's active cart for a shop, creating the cart if
  # this is the first item added. Adding an item already in the cart increments
  # its quantity rather than creating a duplicate row.
  #
  # Availability (enabled, belongs to the shop) is checked here so a cart can
  # never hold an item it shouldn't; full price/availability revalidation still
  # happens again at checkout (M3), since a cart can sit for a while before use.
  class AddItem
    def initialize(customer_profile:, shop:, item:, quantity: 1)
      @customer_profile = customer_profile
      @shop = shop
      @item = item
      @quantity = quantity
    end

    def call
      unless @item.shop_id == @shop.id && @item.enabled?
        raise ApiError::UnprocessableEntity, "This item is not available"
      end
      raise ApiError::UnprocessableEntity, "Quantity must be positive" unless @quantity.to_i.positive?

      cart = @customer_profile.carts.active.find_or_create_by!(shop: @shop)
      cart_item = cart.cart_items.find_by(item: @item)
      if cart_item
        cart_item.update!(quantity: cart_item.quantity + @quantity.to_i)
      else
        cart.cart_items.create!(item: @item, quantity: @quantity.to_i)
      end
      cart
    end
  end
end
