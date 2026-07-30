FactoryBot.define do
  factory :early_access_signup do
    sequence(:email) { |n| "prospect#{n}@example.com" }
    name { "Interested Neighbor" }
    interest { "buyer" }
  end
end
