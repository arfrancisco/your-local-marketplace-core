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

    it "shows the building label but never the vendor's exact unit" do
      shop = create(:shop, :open, building: "Astra", address: "Unit 12F")

      get "/api/v1/shops", headers: auth_headers(customer)

      body = json["shops"].first
      expect(body["building"]).to eq("Astra")
      expect(body).not_to have_key("address")
      expect(shop.address).to eq("Unit 12F") # sanity: the private detail still exists on the record
    end

    it "never exposes another vendor's setup-wizard progress to a customer" do
      shop = create(:shop, :open, onboarding_step: "items")

      get "/api/v1/shops", headers: auth_headers(customer)

      body = json["shops"].first
      expect(body).not_to have_key("onboarding_step")
      expect(body).not_to have_key("onboarding_completed_at")
      expect(shop.onboarding_step).to eq("items") # sanity: it still exists on the record
    end

    it "reports the enabled-item price range, and completed orders only in the order count" do
      shop = create(:shop, :open)
      create(:item, shop: shop, price_cents: 12_000)
      create(:item, shop: shop, price_cents: 28_000)
      create(:item, shop: shop, price_cents: 99_000, enabled: false) # excluded: not shown to customers anyway

      create(:order, :completed, shop: shop)
      create(:order, :completed, shop: shop)
      create(:order, shop: shop, status: "cancelled")

      get "/api/v1/shops", headers: auth_headers(customer)

      body = json["shops"].first
      expect(body["price_range_cents"]).to eq({ "min" => 12_000, "max" => 28_000 })
      expect(body["completed_orders_count"]).to eq(2)
    end

    it "has no price range for a shop with no enabled items" do
      shop = create(:shop, :open)
      create(:item, shop: shop, enabled: false)

      get "/api/v1/shops", headers: auth_headers(customer)

      expect(json["shops"].first["price_range_cents"]).to be_nil
    end

    it "orders by the daily rotation service, not alphabetically" do
      # The non-alphabetical claim itself is proven deterministically (with
      # controlled ids) in spec/services/shop_rotation_spec.rb. This only
      # proves the controller is actually wired to that service — asserting
      # "not alphabetical" here too would depend on these shops' real
      # auto-increment ids, which shift with how many shops other tests in
      # the same run created, since Postgres sequences aren't transactional.
      %w[Alpha Bravo Charlie Delta].each { |n| create(:shop, :open, name: n) }

      travel_to(Date.new(2026, 1, 1)) do
        get "/api/v1/shops", headers: auth_headers(customer)
      end

      returned = json["shops"].map { |s| s["name"] }
      expected = ShopRotation.order(Shop.listed, on: Date.new(2026, 1, 1)).map(&:name)
      expect(returned).to eq(expected)
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

      it "matches a natural multi-word query across different items/tags, not as one literal phrase" do
        shop = create(:shop, :open, name: "Brew & Co.")
        latte = create(:item, shop: shop, name: "Iced Spanish Latte")
        latte.tags = Tag.for_names(["Drinks"])
        barako = create(:item, shop: shop, name: "Kapeng Barako")
        barako.tags = Tag.for_names(["Coffee"])
        create(:shop, :open, name: "Sizzle House")

        # Neither item name literally contains the phrase "iced coffee".
        get "/api/v1/shops", params: { q: "iced coffee" }
        expect(json["shops"].map { |s| s["slug"] }).to eq([shop.slug])
      end

      it "requires every word to match, so an unrelated extra word excludes the shop" do
        create(:shop, :open, name: "Brew & Co.", description: "Small-batch coffee")
        get "/api/v1/shops", params: { q: "coffee sushi" }
        expect(json["shops"]).to eq([])
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

  describe "shop rating aggregates" do
    # Ratings hang off a completed order, so each helper call builds the whole
    # chain: a customer, their completed order at this shop, and the review.
    def rate!(shop, score)
      order = create(:order, :completed, shop: shop, customer_profile: create(:user, :customer).customer_profile)
      create(:rating, order: order, reviewer_user: order.customer_profile.user, reviewee: shop, score: score)
    end

    it "reports a null average and zero count for an unrated shop" do
      shop = create(:shop, :open)
      get "/api/v1/shops/#{shop.slug}"

      expect(json.dig("shop", "average_rating")).to be_nil
      expect(json.dig("shop", "ratings_count")).to eq(0)
    end

    it "reports the average rounded to one decimal place and the count" do
      shop = create(:shop, :open)
      [5, 4, 4].each { |score| rate!(shop, score) }

      get "/api/v1/shops/#{shop.slug}"

      # A JSON number, not a BigDecimal serialized as a string.
      expect(json.dig("shop", "average_rating")).to eq(4.3)
      expect(json.dig("shop", "ratings_count")).to eq(3)
    end

    it "includes the aggregates on the shop listing too" do
      shop = create(:shop, :open)
      rate!(shop, 2)

      get "/api/v1/shops"

      listed = json["shops"].find { |s| s["slug"] == shop.slug }
      expect(listed["average_rating"]).to eq(2.0)
      expect(listed["ratings_count"]).to eq(1)
    end
  end

  describe "GET /api/v1/shops/:slug/ratings" do
    let(:shop) { create(:shop, :open) }

    def rate!(shop, score, comment: nil, created_at: Time.current)
      order = create(:order, :completed, shop: shop, customer_profile: create(:user, :customer).customer_profile)
      create(:rating, order: order, reviewer_user: order.customer_profile.user,
                      reviewee: shop, score: score, comment: comment, created_at: created_at)
    end

    it "lists the shop's reviews newest first, without authentication" do
      rate!(shop, 3, comment: "Older", created_at: 2.days.ago)
      rate!(shop, 5, comment: "Newer", created_at: 1.hour.ago)

      get "/api/v1/shops/#{shop.slug}/ratings"

      expect(response).to have_http_status(:ok)
      expect(json["ratings"].map { |r| r["comment"] }).to eq(%w[Newer Older])
      expect(json["ratings"].first.keys)
        .to match_array(%w[id score comment reviewer_display_name created_at])
    end

    it "returns an empty list for a shop with no reviews" do
      get "/api/v1/shops/#{shop.slug}/ratings"
      expect(json["ratings"]).to eq([])
    end

    it "honours limit and offset" do
      3.times { |i| rate!(shop, 5, comment: "Review #{i}", created_at: i.hours.ago) }

      get "/api/v1/shops/#{shop.slug}/ratings", params: { limit: 1, offset: 1 }

      expect(json["ratings"].size).to eq(1)
      expect(json["ratings"].first["comment"]).to eq("Review 1")
    end

    it "clamps an oversized limit rather than erroring" do
      rate!(shop, 5)
      get "/api/v1/shops/#{shop.slug}/ratings", params: { limit: 5_000 }
      expect(response).to have_http_status(:ok)
      expect(json["ratings"].size).to eq(1)
    end

    it "404s for a shop that is not open" do
      hidden = create(:shop) # draft
      get "/api/v1/shops/#{hidden.slug}/ratings"
      expect(response).to have_http_status(:not_found)
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
