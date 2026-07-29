require "rails_helper"

RSpec.describe "Api::V1::Vendor Items", type: :request do
  let(:vendor_user) { create(:user, :vendor) }
  let(:shop) { create(:shop, vendor_profile: vendor_user.vendor_profile) }

  describe "POST /api/v1/vendor/shops/:shop_id/items" do
    let(:params) do
      { item: { name: "Adobo Bowl", description: "Pork adobo", price_cents: 18_000,
                tags: ["Rice Meal", "savory"] } }
    end

    it "creates an orderable item with tags" do
      expect {
        post "/api/v1/vendor/shops/#{shop.id}/items", params: params, headers: auth_headers(vendor_user)
      }.to change(Item, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(json.dig("item", "name")).to eq("Adobo Bowl")
      expect(json.dig("item", "tags").map { |t| t["slug"] }).to contain_exactly("rice-meal", "savory")
    end

    it "rejects a non-positive price" do
      params[:item][:price_cents] = 0
      post "/api/v1/vendor/shops/#{shop.id}/items", params: params, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "forbids adding an item to another vendor's shop" do
      others_shop = create(:shop)
      post "/api/v1/vendor/shops/#{others_shop.id}/items", params: params, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "PATCH /api/v1/vendor/items/:id" do
    let!(:item) { create(:item, shop: shop) }

    it "updates fields" do
      patch "/api/v1/vendor/items/#{item.id}", params: { item: { price_cents: 22_000 } }, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:ok)
      expect(item.reload.price_cents).to eq(22_000)
    end

    it "forbids editing another vendor's item" do
      others_item = create(:item)
      patch "/api/v1/vendor/items/#{others_item.id}", params: { item: { price_cents: 1 } }, headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "enable/disable" do
    let!(:item) { create(:item, shop: shop) }

    it "disables and re-enables an item" do
      post "/api/v1/vendor/items/#{item.id}/disable", headers: auth_headers(vendor_user)
      expect(json.dig("item", "enabled")).to be(false)

      post "/api/v1/vendor/items/#{item.id}/enable", headers: auth_headers(vendor_user)
      expect(json.dig("item", "enabled")).to be(true)
    end
  end

  describe "end-to-end M1 acceptance" do
    it "a vendor creates an open shop with one orderable item" do
      post "/api/v1/vendor/shops",
           params: { shop: { name: "Acceptance Shop", fulfillment_methods: %w[pickup] } },
           headers: auth_headers(vendor_user)
      shop_id = json.dig("shop", "id")

      post "/api/v1/vendor/shops/#{shop_id}/open", headers: auth_headers(vendor_user)
      expect(json.dig("shop", "open")).to be(true)

      post "/api/v1/vendor/shops/#{shop_id}/items",
           params: { item: { name: "Only Item", price_cents: 9_900 } },
           headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:created)
      expect(json.dig("item", "enabled")).to be(true)
    end
  end
end
