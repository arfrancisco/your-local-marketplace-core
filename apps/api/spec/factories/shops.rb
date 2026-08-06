FactoryBot.define do
  factory :shop do
    vendor_profile
    sequence(:name) { |n| "Corner Kitchen #{n}" }
    description { "Home-cooked meals from unit 12F." }
    building { "Astra" }
    address { "Unit 12F" }
    fulfillment_methods { %w[pickup] }
    status { "draft" }
    accepting_orders { false }

    trait :open do
      status { "active" }
      accepting_orders { true }
    end

    trait :with_item do
      after(:create) { |shop| create(:item, shop: shop) }
    end
  end

  factory :item do
    shop
    sequence(:name) { |n| "Adobo Rice Bowl #{n}" }
    description { "Pork adobo over garlic rice." }
    price_cents { 18_000 }
    currency { "PHP" }
    enabled { true }
    position { 0 }
  end

  factory :tag do
    sequence(:name) { |n| "Tag #{n}" }
  end
end
