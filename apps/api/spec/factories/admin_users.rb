FactoryBot.define do
  factory :admin_user do
    sequence(:email) { |n| "admin#{n}@example.com" }
    password { "sup3rsecret" }
    sequence(:first_name) { |n| "Admin#{n}" }
    last_name { "Operator" }

    trait :suspended do
      status { "suspended" }
    end
  end
end
