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

    # Every real order gets a conversation at checkout (Carts::Checkout).
    # Opt-in trait, not default — the :conversation factory itself builds
    # its own order via this factory, so making this automatic here would
    # double-create a conversation for that path.
    trait :with_conversation do
      after(:create) { |order| create(:conversation, order: order) unless order.conversation }
    end

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
