module Carts
  # Destroys the customer's active cart for a shop, if one exists. Used by the
  # frontend's one-shop-at-a-time cart policy: a customer switching to a
  # different shop's cart confirms replacing the old one first, which calls
  # this before adding the new item. No-op if there is nothing to clear.
  class Clear
    def initialize(customer_profile:, shop:)
      @customer_profile = customer_profile
      @shop = shop
    end

    def call
      @customer_profile.carts.active.find_by(shop: @shop)&.destroy
    end
  end
end
