require "rails_helper"

RSpec.describe "Api::V1::Vendor Orders", type: :request do
  let(:vendor_user) { create(:user, :vendor) }
  # One shop per vendor for now (Shop#validates vendor_profile_id
  # uniqueness) — shop_b belongs to a different vendor, not a second shop of
  # vendor_user's, so these specs still exercise "never see another vendor's
  # orders" without needing an impossible multi-shop-per-vendor state.
  let(:shop_a) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile) }
  let(:shop_b) { create(:shop, :open) }
  let(:customer) { create(:user, :customer) }

  describe "GET /api/v1/vendor/orders" do
    it "returns the vendor's own shop orders, never another vendor's" do
      order_a = create(:order, shop: shop_a, customer_profile: customer.customer_profile)
      create(:order, shop: shop_b, customer_profile: customer.customer_profile)

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:ok)
      expect(json["orders"].map { |o| o["id"] }).to contain_exactly(order_a.id)
    end

    it "filters to that shop when shop_id is given" do
      order_a = create(:order, shop: shop_a, customer_profile: customer.customer_profile)
      create(:order, shop: shop_b, customer_profile: customer.customer_profile)

      get "/api/v1/vendor/orders", params: { shop_id: shop_a.id }, headers: auth_headers(vendor_user)
      expect(json["orders"].map { |o| o["id"] }).to contain_exactly(order_a.id)
    end

    it "never returns another vendor's shop orders, even by guessing a shop_id" do
      other_shop = create(:shop, :open)
      create(:order, shop: other_shop, customer_profile: customer.customer_profile)

      get "/api/v1/vendor/orders", params: { shop_id: other_shop.id }, headers: auth_headers(vendor_user)
      expect(json["orders"]).to eq([])
    end

    it "includes the customer's current name, residency, and default address building/unit" do
      address = create(:address, user: customer)
      customer.customer_profile.update!(default_address: address, is_resident: true, willing_to_verify_residency: true)
      order_a = create(:order, shop: shop_a, customer_profile: customer.customer_profile)

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      json_order = json["orders"].find { |o| o["id"] == order_a.id }

      expect(json_order["customer_name"]).to eq(customer.customer_profile.display_name)
      expect(json_order["customer_is_resident"]).to eq(true)
      expect(json_order["customer_building"]).to eq("Astra")
      expect(json_order["customer_unit"]).to eq("12F")
    end

    it "returns nil building/unit when the customer has no default address on file" do
      order_a = create(:order, shop: shop_a, customer_profile: customer.customer_profile)

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      json_order = json["orders"].find { |o| o["id"] == order_a.id }

      expect(json_order["customer_building"]).to be_nil
      expect(json_order["customer_unit"]).to be_nil
    end

    it "flags has_unread_messages true for the vendor when the customer posted a message they haven't read" do
      order_a = create(:order, :with_conversation, shop: shop_a, customer_profile: customer.customer_profile)
      create(:message, conversation: order_a.conversation, sender_user: customer, body: "When will it be ready?")

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      json_order = json["orders"].find { |o| o["id"] == order_a.id }
      expect(json_order["has_unread_messages"]).to eq(true)
    end

    it "flags has_unread_messages false for the vendor's own message" do
      order_a = create(:order, :with_conversation, shop: shop_a, customer_profile: customer.customer_profile)
      create(:message, conversation: order_a.conversation, sender_user: vendor_user, body: "Accepted!")

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      json_order = json["orders"].find { |o| o["id"] == order_a.id }
      expect(json_order["has_unread_messages"]).to eq(false)
    end

    it "flags has_unread_messages false once the vendor marks the conversation read" do
      order_a = create(:order, :with_conversation, shop: shop_a, customer_profile: customer.customer_profile)
      create(:message, conversation: order_a.conversation, sender_user: customer, body: "When will it be ready?")
      post "/api/v1/orders/#{order_a.id}/conversation/mark_read", headers: auth_headers(vendor_user)

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      json_order = json["orders"].find { |o| o["id"] == order_a.id }
      expect(json_order["has_unread_messages"]).to eq(false)
    end

    it "reports the same shop-level rating aggregate on every order, precomputed once for the vendor's one shop" do
      other_customer = create(:user, :customer)
      order_a = create(:order, shop: shop_a, customer_profile: customer.customer_profile)
      order_b = create(:order, shop: shop_a, customer_profile: other_customer.customer_profile)
      create(:rating, order: order_a, reviewer_user: customer, reviewee: shop_a, score: 4)

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      returned = json["orders"].index_by { |o| o["id"] }

      expect(returned[order_a.id]["shop_average_rating"]).to eq(4.0)
      expect(returned[order_a.id]["shop_ratings_count"]).to eq(1)
      expect(returned[order_b.id]["shop_average_rating"]).to eq(4.0)
      expect(returned[order_b.id]["shop_ratings_count"]).to eq(1)
    end

    it "reports each order's own rating, not another order's, once shop-level aggregates are precomputed" do
      other_customer = create(:user, :customer)
      order_a = create(:order, shop: shop_a, customer_profile: customer.customer_profile)
      order_b = create(:order, shop: shop_a, customer_profile: other_customer.customer_profile)
      create(:rating, order: order_a, reviewer_user: customer, reviewee: shop_a, score: 5, comment: "Loved it")
      create(:rating, order: order_b, reviewer_user: other_customer, reviewee: shop_a, score: 2, comment: "Meh")

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      returned = json["orders"].index_by { |o| o["id"] }

      expect(returned[order_a.id]["rating"]["score"]).to eq(5)
      expect(returned[order_b.id]["rating"]["score"]).to eq(2)
    end
  end
end
