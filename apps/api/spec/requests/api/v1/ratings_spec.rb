require "rails_helper"

RSpec.describe "Api::V1 Ratings", type: :request do
  let(:customer) { create(:user, :customer) }
  let(:vendor_user) { create(:user, :vendor) }
  let(:shop) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile) }
  let(:order) { create(:order, :completed, customer_profile: customer.customer_profile, shop: shop) }

  describe "POST /api/v1/orders/:id/ratings" do
    it "creates a rating for the order's customer" do
      post "/api/v1/orders/#{order.id}/ratings",
           params: { score: 5, comment: "Excellent." }, headers: auth_headers(customer)

      expect(response).to have_http_status(:created)
      expect(json.dig("rating", "score")).to eq(5)
      expect(json.dig("rating", "comment")).to eq("Excellent.")
      expect(json.dig("rating", "reviewer_display_name")).to eq(customer.customer_profile.display_name)
      expect(order.reload.ratings.sole.reviewee).to eq(shop)
    end

    it "accepts a rating with no comment" do
      post "/api/v1/orders/#{order.id}/ratings", params: { score: 4 }, headers: auth_headers(customer)
      expect(response).to have_http_status(:created)
      expect(json.dig("rating", "comment")).to be_nil
    end

    it "422s when the order is not completed" do
      placed = create(:order, customer_profile: customer.customer_profile, shop: shop, status: "placed")

      post "/api/v1/orders/#{placed.id}/ratings", params: { score: 5 }, headers: auth_headers(customer)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "422s on a duplicate rating for the same order" do
      post "/api/v1/orders/#{order.id}/ratings", params: { score: 5 }, headers: auth_headers(customer)
      expect(response).to have_http_status(:created)

      post "/api/v1/orders/#{order.id}/ratings", params: { score: 1 }, headers: auth_headers(customer)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(order.reload.ratings.count).to eq(1)
    end

    it "422s on a score outside 1..5" do
      post "/api/v1/orders/#{order.id}/ratings", params: { score: 9 }, headers: auth_headers(customer)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "400s when score is missing" do
      post "/api/v1/orders/#{order.id}/ratings", headers: auth_headers(customer)
      expect(response).to have_http_status(:bad_request)
    end

    it "403s for an unrelated user" do
      other = create(:user, :customer)
      post "/api/v1/orders/#{order.id}/ratings", params: { score: 5 }, headers: auth_headers(other)
      expect(response).to have_http_status(:forbidden)
    end

    it "403s for the shop's vendor, who may see the order but not rate it" do
      post "/api/v1/orders/#{order.id}/ratings", params: { score: 5 }, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:forbidden)
    end

    it "401s without authentication" do
      post "/api/v1/orders/#{order.id}/ratings", params: { score: 5 }
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "the rating on the order payload" do
    it "is null before rating and present afterwards" do
      get "/api/v1/orders/#{order.id}", headers: auth_headers(customer)
      expect(json.dig("order", "rating")).to be_nil

      create(:rating, order: order, reviewer_user: customer, reviewee: shop, score: 3)

      get "/api/v1/orders/#{order.id}", headers: auth_headers(customer)
      expect(json.dig("order", "rating", "score")).to eq(3)
    end
  end
end
