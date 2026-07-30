FactoryBot.define do
  factory :cart do
    customer_profile
    shop
    status { "active" }
  end

  factory :cart_item do
    cart
    item
    quantity { 1 }
  end
end
