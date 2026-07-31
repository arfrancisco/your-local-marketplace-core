require "rails_helper"

RSpec.describe "Api::V1 Cart", type: :request do
  let(:customer) { create(:user, :customer) }
  let(:shop) { create(:shop, :open) }
  let(:item) { create(:item, shop: shop, price_cents: 10_000) }

  describe "GET /api/v1/cart" do
    it "returns null when there is no active cart for the shop" do
      get "/api/v1/cart", params: { shop_id: shop.id }, headers: auth_headers(customer)
      expect(response).to have_http_status(:ok)
      expect(json["cart"]).to be_nil
    end

    it "returns the current cart with computed line totals" do
      post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 2 }, headers: auth_headers(customer)
      get "/api/v1/cart", params: { shop_id: shop.id }, headers: auth_headers(customer)

      cart = json["cart"]
      expect(cart["items"].first).to include("quantity" => 2, "line_total_cents" => 20_000)
      expect(cart["subtotal_cents"]).to eq(20_000)
    end
  end

  describe "POST /api/v1/cart/items" do
    it "creates a cart and adds the item" do
      post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 1 }, headers: auth_headers(customer)
      expect(response).to have_http_status(:created)
      expect(json.dig("cart", "items").size).to eq(1)
    end

    it "increments quantity instead of duplicating when the item is added again" do
      2.times do
        post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 1 }, headers: auth_headers(customer)
      end
      expect(json.dig("cart", "items").size).to eq(1)
      expect(json.dig("cart", "items").first["quantity"]).to eq(2)
    end

    it "rejects a disabled item" do
      item.update!(enabled: false)
      post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 1 }, headers: auth_headers(customer)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "404s for an item that belongs to a different shop than given" do
      other_shop = create(:shop, :open)
      post "/api/v1/cart/items", params: { shop_id: other_shop.id, item_id: item.id, quantity: 1 }, headers: auth_headers(customer)
      expect(response).to have_http_status(:not_found)
    end

    it "404s for a shop that is not open" do
      draft_shop = create(:shop) # not open
      draft_item = create(:item, shop: draft_shop)
      post "/api/v1/cart/items", params: { shop_id: draft_shop.id, item_id: draft_item.id, quantity: 1 }, headers: auth_headers(customer)
      expect(response).to have_http_status(:not_found)
    end

    it "forbids a user without a customer profile" do
      vendor_only = create(:user, :vendor)
      post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 1 }, headers: auth_headers(vendor_only)
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH /api/v1/cart/items/:id" do
    it "updates the quantity" do
      post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 1 }, headers: auth_headers(customer)
      cart_item_id = json.dig("cart", "items").first["id"]

      patch "/api/v1/cart/items/#{cart_item_id}", params: { quantity: 5 }, headers: auth_headers(customer)
      expect(json.dig("cart", "items").first["quantity"]).to eq(5)
    end

    it "404s for another customer's cart item" do
      post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 1 }, headers: auth_headers(customer)
      cart_item_id = json.dig("cart", "items").first["id"]

      other_customer = create(:user, :customer)
      patch "/api/v1/cart/items/#{cart_item_id}", params: { quantity: 3 }, headers: auth_headers(other_customer)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "DELETE /api/v1/cart/items/:id" do
    it "removes the item from the cart" do
      post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 1 }, headers: auth_headers(customer)
      cart_item_id = json.dig("cart", "items").first["id"]

      delete "/api/v1/cart/items/#{cart_item_id}", headers: auth_headers(customer)
      expect(response).to have_http_status(:ok)
      expect(json.dig("cart", "items")).to eq([])
    end
  end

  describe "POST /api/v1/cart/checkout" do
    it "converts the cart into an order" do
      post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 2 }, headers: auth_headers(customer)

      post "/api/v1/cart/checkout", params: { shop_id: shop.id, fulfillment_method: "pickup" }, headers: auth_headers(customer)
      expect(response).to have_http_status(:created)
      expect(json.dig("order", "status")).to eq("placed")
      expect(json.dig("order", "items").first).to include("quantity" => 2)
    end

    it "404s when there is no active cart for the shop" do
      post "/api/v1/cart/checkout", params: { shop_id: shop.id, fulfillment_method: "pickup" }, headers: auth_headers(customer)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "cart isolation across shops" do
    it "keeps separate carts per shop for the same customer" do
      other_shop = create(:shop, :open)
      other_item = create(:item, shop: other_shop)

      post "/api/v1/cart/items", params: { shop_id: shop.id, item_id: item.id, quantity: 1 }, headers: auth_headers(customer)
      post "/api/v1/cart/items", params: { shop_id: other_shop.id, item_id: other_item.id, quantity: 1 }, headers: auth_headers(customer)

      get "/api/v1/cart", params: { shop_id: shop.id }, headers: auth_headers(customer)
      expect(json.dig("cart", "items").first["item_id"]).to eq(item.id)
    end
  end
end
