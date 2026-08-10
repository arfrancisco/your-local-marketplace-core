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

    it "flags has_unread_messages true when the vendor posted a message the customer hasn't read" do
      create(:message, conversation: order.conversation, sender_user: vendor_user, body: "Accepted!")
      get "/api/v1/orders", headers: auth_headers(customer)
      json_order = json["orders"].find { |o| o["id"] == order.id }
      expect(json_order["has_unread_messages"]).to eq(true)
    end

    it "flags has_unread_messages false once the customer marks the conversation read" do
      create(:message, conversation: order.conversation, sender_user: vendor_user, body: "Accepted!")
      post "/api/v1/orders/#{order.id}/conversation/mark_read", headers: auth_headers(customer)

      get "/api/v1/orders", headers: auth_headers(customer)
      json_order = json["orders"].find { |o| o["id"] == order.id }
      expect(json_order["has_unread_messages"]).to eq(false)
    end

    it "flags has_unread_messages false for a message the customer sent themselves" do
      create(:message, conversation: order.conversation, sender_user: customer, body: "When will it be ready?")
      get "/api/v1/orders", headers: auth_headers(customer)
      json_order = json["orders"].find { |o| o["id"] == order.id }
      expect(json_order["has_unread_messages"]).to eq(false)
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

    it "includes the customer's current name, residency, and default address building/unit" do
      address = create(:address, user: customer)
      customer.customer_profile.update!(default_address: address, is_resident: true, willing_to_verify_residency: true)

      get "/api/v1/orders/#{order.id}", headers: auth_headers(vendor_user)
      json_order = json["order"]

      expect(json_order["customer_name"]).to eq(customer.customer_profile.display_name)
      expect(json_order["customer_is_resident"]).to eq(true)
      expect(json_order["customer_building"]).to eq("Astra")
      expect(json_order["customer_unit"]).to eq("12F")
    end

    it "returns nil building/unit when the customer has no default address on file" do
      get "/api/v1/orders/#{order.id}", headers: auth_headers(vendor_user)
      json_order = json["order"]

      expect(json_order["customer_building"]).to be_nil
      expect(json_order["customer_unit"]).to be_nil
    end

    it "only offers the transition matching the order's own fulfillment_method, not both" do
      preparing_pickup = create(:order, :with_conversation, shop: shop, status: "preparing", fulfillment_method: "pickup")
      get "/api/v1/orders/#{preparing_pickup.id}", headers: auth_headers(vendor_user)

      expect(json.dig("order", "can_transition_to")).to eq(["ready_for_pickup"])
    end

    it "flags has_unread_messages true for the vendor when the customer posted a message they haven't read" do
      create(:message, conversation: order.conversation, sender_user: customer, body: "When will it be ready?")
      get "/api/v1/orders/#{order.id}", headers: auth_headers(vendor_user)
      expect(json.dig("order", "has_unread_messages")).to eq(true)
    end

    it "flags has_unread_messages false for the vendor's own message" do
      create(:message, conversation: order.conversation, sender_user: vendor_user, body: "Accepted!")
      get "/api/v1/orders/#{order.id}", headers: auth_headers(vendor_user)
      expect(json.dig("order", "has_unread_messages")).to eq(false)
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

    it "lets a vendor accept an order they placed on their own shop (customer and vendor are the same account)" do
      dual_role_user = create(:user, :customer, :vendor)
      own_shop = create(:shop, :open, vendor_profile: dual_role_user.vendor_profile)
      own_order = create(:order, :with_item, :with_conversation,
                          customer_profile: dual_role_user.customer_profile, shop: own_shop)

      post "/api/v1/orders/#{own_order.id}/transitions", params: { to_status: "accepted" }, headers: auth_headers(dual_role_user)
      expect(response).to have_http_status(:ok)
      expect(json.dig("order", "status")).to eq("accepted")
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
