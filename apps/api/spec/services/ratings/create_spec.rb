require "rails_helper"

RSpec.describe Ratings::Create do
  let(:customer) { create(:user, :customer) }
  let(:shop) { create(:shop, :open) }
  let(:order) { create(:order, :completed, customer_profile: customer.customer_profile, shop: shop) }

  it "creates a rating against the order's shop" do
    rating = described_class.new(order: order, reviewer_user: customer, score: 4, comment: "Solid.").call

    expect(rating).to be_persisted
    expect(rating.reviewee).to eq(shop)
    expect(rating.order).to eq(order)
    expect(rating.reviewer_user).to eq(customer)
    expect(rating.score).to eq(4)
    expect(rating.comment).to eq("Solid.")
  end

  it "allows a rating with no comment" do
    rating = described_class.new(order: order, reviewer_user: customer, score: 5, comment: nil).call
    expect(rating.comment).to be_nil
  end

  it "refuses to rate an order that is not completed" do
    placed = create(:order, customer_profile: customer.customer_profile, shop: shop, status: "placed")

    expect { described_class.new(order: placed, reviewer_user: customer, score: 5, comment: nil).call }
      .to raise_error(ApiError::UnprocessableEntity, /completed/)
    expect(Rating.count).to eq(0)
  end

  it "refuses a reviewer who is not the order's customer" do
    stranger = create(:user, :customer)

    expect { described_class.new(order: order, reviewer_user: stranger, score: 5, comment: nil).call }
      .to raise_error(ApiError::Forbidden)
    expect(Rating.count).to eq(0)
  end

  it "refuses the shop's own vendor" do
    vendor_user = shop.vendor_profile.user

    expect { described_class.new(order: order, reviewer_user: vendor_user, score: 5, comment: nil).call }
      .to raise_error(ApiError::Forbidden)
  end

  it "rejects a duplicate rating for the same order" do
    described_class.new(order: order, reviewer_user: customer, score: 5, comment: nil).call

    expect { described_class.new(order: order, reviewer_user: customer, score: 1, comment: nil).call }
      .to raise_error(ActiveRecord::RecordInvalid)
    expect(Rating.count).to eq(1)
  end
end
