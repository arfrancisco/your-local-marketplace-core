FactoryBot.define do
  factory :vendor_customer_note do
    vendor_profile
    customer_profile
    note { "No-showed for pickup." }
    flagged { false }

    trait :flagged do
      flagged { true }
    end
  end
end
