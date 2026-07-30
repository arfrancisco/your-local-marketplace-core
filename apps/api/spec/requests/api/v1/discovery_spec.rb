require "rails_helper"

RSpec.describe "Api::V1 Discovery", type: :request do
  let(:customer) { create(:user, :customer) }

  describe "GET /api/v1/shops" do
    it "lists only open shops, excluding draft and closed ones" do
      open_shop = create(:shop, :open, name: "Open Shop")
      create(:shop, name: "Draft Shop")                              # draft
      create(:shop, :open).update!(accepting_orders: false)          # active but closed

      get "/api/v1/shops", headers: auth_headers(customer)

      expect(response).to have_http_status(:ok)
      slugs = json["shops"].map { |s| s["slug"] }
      expect(slugs).to eq([open_shop.slug])
    end

    it "orders by the daily rotation, not alphabetically" do
      # Create enough shops that alphabetical and rotation order diverge.
      %w[Alpha Bravo Charlie Delta].each { |n| create(:shop, :open, name: n) }

      travel_to(Date.new(2026, 1, 1)) do
        get "/api/v1/shops", headers: auth_headers(customer)
      end

      returned = json["shops"].map { |s| s["name"] }
      expected = ShopRotation.order(Shop.listed, on: Date.new(2026, 1, 1)).map(&:name)
      expect(returned).to eq(expected)
      expect(returned).not_to eq(returned.sort) # not alphabetical
    end

    describe "search (?q=)" do
      it "matches the shop's own name or description" do
        bakery = create(:shop, :open, name: "Corner Bakeshop", description: "Fresh bread daily")
        create(:shop, :open, name: "Sizzle House", description: "Grilled favorites")

        get "/api/v1/shops", params: { q: "bread" }
        expect(json["shops"].map { |s| s["slug"] }).to eq([bakery.slug])
      end

      it "matches an item name inside the shop's catalog" do
        shop = create(:shop, :open, name: "Green Bowl")
        create(:item, shop: shop, name: "Vegan Buddha Bowl")
        create(:shop, :open, name: "Sizzle House")

        get "/api/v1/shops", params: { q: "buddha" }
        expect(json["shops"].map { |s| s["slug"] }).to eq([shop.slug])
      end

      it "matches an item tag" do
        shop = create(:shop, :open, name: "Green Bowl")
        item = create(:item, shop: shop, name: "House Salad")
        item.tags = Tag.for_names(["Vegan"])
        create(:shop, :open, name: "Sizzle House")

        get "/api/v1/shops", params: { q: "vegan" }
        expect(json["shops"].map { |s| s["slug"] }).to eq([shop.slug])
      end

      it "is case-insensitive and matches partial words" do
        shop = create(:shop, :open, name: "Corner Bakeshop")
        get "/api/v1/shops", params: { q: "BAKE" }
        expect(json["shops"].map { |s| s["slug"] }).to eq([shop.slug])
      end

      it "returns everything when the query is blank" do
        create(:shop, :open)
        create(:shop, :open)
        get "/api/v1/shops", params: { q: "" }
        expect(json["shops"].size).to eq(2)
      end

      it "returns an empty list for no matches" do
        create(:shop, :open, name: "Corner Bakeshop")
        get "/api/v1/shops", params: { q: "sushi" }
        expect(json["shops"]).to eq([])
      end

      it "does not surface a shop through a disabled item" do
        shop = create(:shop, :open)
        create(:item, shop: shop, name: "Secret Ramen", enabled: false)
        get "/api/v1/shops", params: { q: "ramen" }
        expect(json["shops"]).to eq([])
      end
    end

    it "is browsable without authentication (public discovery)" do
      create(:shop, :open)
      get "/api/v1/shops"
      expect(response).to have_http_status(:ok)
      expect(json).to have_key("shops")
    end
  end

  describe "GET /api/v1/shops/:slug" do
    it "returns an open shop by slug" do
      shop = create(:shop, :open, name: "Corner Kitchen")
      get "/api/v1/shops/#{shop.slug}", headers: auth_headers(customer)
      expect(response).to have_http_status(:ok)
      expect(json.dig("shop", "slug")).to eq("corner-kitchen")
    end

    it "404s for a shop that is not open" do
      shop = create(:shop, name: "Hidden") # draft
      get "/api/v1/shops/#{shop.slug}", headers: auth_headers(customer)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "GET /api/v1/shops/:slug/items" do
    it "returns only enabled items, ordered by position" do
      shop = create(:shop, :open)
      create(:item, shop: shop, name: "Second", position: 2)
      create(:item, shop: shop, name: "First", position: 1)
      create(:item, shop: shop, name: "Hidden", enabled: false, position: 3)

      get "/api/v1/shops/#{shop.slug}/items", headers: auth_headers(customer)

      names = json["items"].map { |i| i["name"] }
      expect(names).to eq(%w[First Second])
    end
  end

  describe "GET /api/v1/tags" do
    it "lists tags alphabetically" do
      Tag.for_names(["Savory", "Bread", "Vegan"])
      get "/api/v1/tags", headers: auth_headers(customer)
      expect(json["tags"].map { |t| t["name"] }).to eq(%w[Bread Savory Vegan])
    end
  end
end
