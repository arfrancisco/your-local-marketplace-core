require "rails_helper"

RSpec.describe Rating do
  let(:order) { create(:order, :completed) }
  let(:reviewer) { order.customer_profile.user }

  describe "score" do
    it "accepts the ends of the 1..5 range" do
      expect(build(:rating, order: order, reviewer_user: reviewer, reviewee: order.shop, score: 1)).to be_valid
      expect(build(:rating, order: order, reviewer_user: reviewer, reviewee: order.shop, score: 5)).to be_valid
    end

    it "rejects a score below the range" do
      rating = build(:rating, order: order, reviewer_user: reviewer, reviewee: order.shop, score: 0)
      expect(rating).not_to be_valid
      expect(rating.errors[:score]).to be_present
    end

    it "rejects a score above the range" do
      rating = build(:rating, order: order, reviewer_user: reviewer, reviewee: order.shop, score: 6)
      expect(rating).not_to be_valid
      expect(rating.errors[:score]).to be_present
    end
  end

  describe "uniqueness of (order, reviewer, reviewee)" do
    before { create(:rating, order: order, reviewer_user: reviewer, reviewee: order.shop) }

    it "rejects a second rating of the same shop on the same order by the same reviewer" do
      duplicate = build(:rating, order: order, reviewer_user: reviewer, reviewee: order.shop)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:reviewer_user_id]).to be_present
    end

    it "allows the same reviewer to rate a different order" do
      other_order = create(:order, :completed, customer_profile: order.customer_profile)
      expect(build(:rating, order: other_order, reviewer_user: reviewer, reviewee: other_order.shop)).to be_valid
    end

    it "allows a different reviewer on the same order" do
      other_user = create(:user, :customer)
      expect(build(:rating, order: order, reviewer_user: other_user, reviewee: order.shop)).to be_valid
    end
  end
end
