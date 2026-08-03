require "rails_helper"

RSpec.describe "Api::V1 Orders", type: :request do
  let(:customer) { create(:user, :customer) }
  let(:vendor_user) { create(:user, :vendor) }
  let(:shop) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile) }
  let(:order) { create(:order, :with_item, :with_conversation, customer_profile: customer.customer_profile, shop: shop) }

  describe "GET /api/v1/orders" do
    it "returns the current customer's own orders" do
      order
      create(:order, customer_profile: create(:user, :customer).customer_profile, shop: shop) # someone else's

      get "/api/v1/orders", headers: auth_headers(customer)
      expect(json["orders"].size).to eq(1)
      expect(json["orders"].first["id"]).to eq(order.id)
    end

    it "forbids a user without a customer profile" do
      get "/api/v1/orders", headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/orders/:id" do
    it "is visible to the owning customer" do
      get "/api/v1/orders/#{order.id}", headers: auth_headers(customer)
      expect(response).to have_http_status(:ok)
      expect(json.dig("order", "public_reference")).to eq(order.public_reference)
    end

    it "is visible to the shop's vendor" do
      get "/api/v1/orders/#{order.id}", headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:ok)
    end

    it "403s for an unrelated user" do
      other = create(:user, :customer)
      get "/api/v1/orders/#{order.id}", headers: auth_headers(other)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/orders/:id/transitions" do
    it "lets the vendor accept an order" do
      post "/api/v1/orders/#{order.id}/transitions", params: { to_status: "accepted" }, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:ok)
      expect(json.dig("order", "status")).to eq("accepted")
    end

    it "lets the customer cancel their own order with a reason" do
      post "/api/v1/orders/#{order.id}/transitions",
           params: { to_status: "cancelled", reason_code: "changed_mind" }, headers: auth_headers(customer)
      expect(response).to have_http_status(:ok)
      expect(json.dig("order", "status")).to eq("cancelled")
    end

    it "422s a cancellation with no reason_code" do
      post "/api/v1/orders/#{order.id}/transitions", params: { to_status: "cancelled" }, headers: auth_headers(customer)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "422s a cancellation with reason_code 'other' and no free-text reason" do
      post "/api/v1/orders/#{order.id}/transitions",
           params: { to_status: "cancelled", reason_code: "other" }, headers: auth_headers(customer)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "accepts reason_code 'other' together with a free-text reason" do
      post "/api/v1/orders/#{order.id}/transitions",
           params: { to_status: "cancelled", reason_code: "other", reason: "Ordering somewhere else instead" },
           headers: auth_headers(customer)
      expect(response).to have_http_status(:ok)
    end

    it "lets the vendor cancel with a reason from the vendor's own list" do
      post "/api/v1/orders/#{order.id}/transitions",
           params: { to_status: "cancelled", reason_code: "item_unavailable" }, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:ok)
    end

    it "forbids the customer from accepting their own order" do
      post "/api/v1/orders/#{order.id}/transitions", params: { to_status: "accepted" }, headers: auth_headers(customer)
      expect(response).to have_http_status(:forbidden)
    end

    it "422s on an illegal transition" do
      post "/api/v1/orders/#{order.id}/transitions", params: { to_status: "completed" }, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "PATCH /api/v1/orders/:id/items" do
    let(:extra_item) { create(:item, shop: shop, name: "Halo-Halo", price_cents: 12_000) }

    it "lets the vendor add a new line item and returns the updated order" do
      patch "/api/v1/orders/#{order.id}/items",
            params: { items: [{ item_id: extra_item.id, quantity: 2 }] },
            headers: auth_headers(vendor_user)

      expect(response).to have_http_status(:ok)
      expect(json.dig("order", "items").size).to eq(2)
    end

    it "forbids the customer from editing their own order's items" do
      patch "/api/v1/orders/#{order.id}/items",
            params: { items: [{ item_id: extra_item.id, quantity: 2 }] },
            headers: auth_headers(customer)

      expect(response).to have_http_status(:forbidden)
    end

    it "403s for an unrelated vendor" do
      other = create(:user, :vendor)
      patch "/api/v1/orders/#{order.id}/items",
            params: { items: [{ item_id: extra_item.id, quantity: 2 }] },
            headers: auth_headers(other)

      expect(response).to have_http_status(:forbidden)
    end

    it "422s once the order is out for the vendor's control (e.g. completed)" do
      order.update!(status: "completed")
      patch "/api/v1/orders/#{order.id}/items",
            params: { items: [{ item_id: extra_item.id, quantity: 2 }] },
            headers: auth_headers(vendor_user)

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "POST /api/v1/orders/:id/mark_paid" do
    it "lets the vendor mark the order as paid" do
      post "/api/v1/orders/#{order.id}/mark_paid", headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:ok)
      expect(json.dig("order", "payment_status")).to eq("marked_paid")
    end

    it "forbids the customer from marking their own order paid" do
      post "/api/v1/orders/#{order.id}/mark_paid", headers: auth_headers(customer)
      expect(response).to have_http_status(:forbidden)
    end

    it "403s for an unrelated user" do
      other = create(:user, :vendor)
      post "/api/v1/orders/#{order.id}/mark_paid", headers: auth_headers(other)
      expect(response).to have_http_status(:forbidden)
    end
  end
end
