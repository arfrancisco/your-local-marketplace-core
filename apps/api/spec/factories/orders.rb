FactoryBot.define do
  factory :order do
    customer_profile
    shop
    fulfillment_method { "pickup" }
    status { "placed" }
    subtotal_cents { 10_000 }
    total_cents { 10_000 }
    currency { "PHP" }
    placed_at { Time.current }

    trait :with_item do
      after(:create) do |order|
        create(:order_item, order: order, unit_price_cents: 10_000, quantity: 1, line_total_cents: 10_000)
      end
    end
  end

  factory :order_item do
    order
    item
    sequence(:item_name) { |n| "Snapshot item #{n}" }
    unit_price_cents { 10_000 }
    quantity { 1 }
    line_total_cents { 10_000 }
  end

  factory :conversation do
    order
  end

  factory :message do
    conversation
    message_type { "text" }
    body { "Hello!" }
  end
end
