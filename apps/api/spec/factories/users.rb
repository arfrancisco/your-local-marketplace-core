FactoryBot.define do
  factory :user do
    sequence(:email) { |n| "user#{n}@example.com" }
    sequence(:mobile_number) { |n| "+639#{format('%09d', n)}" }
    password { "sup3rsecret" }

    trait :email_verified do
      email_verified_at { Time.current }
    end

    trait :mobile_verified do
      mobile_verified_at { Time.current }
    end

    trait :verified do
      email_verified
      mobile_verified
    end

    trait :suspended do
      status { "suspended" }
    end

    trait :demo do
      demo { true }
    end

    trait :customer do
      after(:create) { |user| create(:customer_profile, user: user) }
    end

    trait :vendor do
      after(:create) { |user| create(:vendor_profile, user: user) }
    end
  end

  factory :customer_profile do
    user
    sequence(:display_name) { |n| "Customer #{n}" }
  end

  factory :vendor_profile do
    user
    sequence(:display_name) { |n| "Vendor #{n}" }
    verification_status { "unverified" }
  end

  factory :address do
    user
    label { "Home" }
    recipient_name { "Juan Dela Cruz" }
    building { "Astra" }
    unit { "12F" }
  end
end
