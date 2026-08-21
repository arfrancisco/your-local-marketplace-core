require "rails_helper"

RSpec.describe "Api::V1::Admin::Shops", type: :request do
  let(:shop) { create(:shop) }

  describe "GET /api/v1/admin/shops" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/shops" }

    it_behaves_like "requires admin auth"

    it "includes payment/opening-message info unlike public discovery" do
      shop.update!(opening_message: "GCash to 0917-000-0000")
      get "/api/v1/admin/shops", headers: admin_auth_headers
      found = json["shops"].find { |s| s["id"] == shop.id }
      expect(found["opening_message"]).to eq("GCash to 0917-000-0000")
    end

    it "reports demo and the vendor's verification status, and filters by demo" do
      demo_shop = create(:shop, vendor_profile: create(:vendor_profile, user: create(:user, :demo)))
      shop.vendor_profile.update!(verification_status: "verified")

      get "/api/v1/admin/shops", headers: admin_auth_headers
      found = json["shops"].find { |s| s["id"] == shop.id }
      expect(found["demo"]).to eq(false)
      expect(found["vendor_verification_status"]).to eq("verified")

      get "/api/v1/admin/shops", params: { demo: "true" }, headers: admin_auth_headers
      expect(json["shops"].map { |s| s["id"] }).to eq([demo_shop.id])
    end

    # This endpoint is where the per-row query problem actually bites: it
    # paginates up to 200 shops, and each serialized row reads :items twice
    # (price_range_cents, open_blockers) and :ratings twice (average_rating,
    # ratings_count). A model-level test cannot catch a regression here,
    # because what breaks is the scope — swapping in Shop.search (whose raw
    # SQL references items) would promote the preload to an eager-load join,
    # and changing filter_by_demo could drop it entirely.
    #
    # Scoped to those two tables on purpose. Three other things on this
    # endpoint still cost a query per row, and none belong to this change:
    # completed_orders_count (orders), vendor_verification_status/demo?
    # (vendor_profiles, users) and the shop photos (active_storage_
    # attachments). The vendor_profile one especially wants its own change:
    # filter_by_demo already joins that same association, so preloading it
    # risks being promoted to an eager-load join and inflating
    # pagination_meta's count. Asserting a flat TOTAL here would either fail
    # on that pre-existing cost or, once loosened, quietly bless it.
    it "does not read items or ratings more often as more shops land on the page" do
      customer = create(:user, :customer)
      seed_shop = lambda do
        s = create(:shop, :open)
        2.times { create(:item, shop: s) }
        order = create(:order, shop: s, customer_profile: customer.customer_profile)
        create(:rating, order: order, reviewer_user: customer, reviewee: s, score: 4)
      end

      count_preloaded_reads = lambda do |&block|
        queries = 0
        counter = lambda do |*, payload|
          next if payload[:name] == "SCHEMA" || payload[:cached]

          queries += 1 if payload[:sql].match?(/FROM "(items|ratings)"/)
        end
        ActiveSupport::Notifications.subscribed(counter, "sql.active_record", &block)
        queries
      end

      2.times { seed_shop.call }
      with_two = count_preloaded_reads.call { get "/api/v1/admin/shops", headers: admin_auth_headers }
      expect(response).to have_http_status(:ok)
      expect(json["shops"].size).to eq(2)

      3.times { seed_shop.call }
      with_five = count_preloaded_reads.call { get "/api/v1/admin/shops", headers: admin_auth_headers }
      expect(response).to have_http_status(:ok)
      expect(json["shops"].size).to eq(5)

      # One preload each, however many shops are on the page.
      expect(with_two).to eq(2)
      expect(with_five).to eq(2)
    end
  end

  describe "GET /api/v1/admin/shops/:id" do
    it "nests the vendor profile and its underlying user, unlike the list endpoint" do
      shop.vendor_profile.update!(verification_status: "pending")

      get "/api/v1/admin/shops/#{shop.id}", headers: admin_auth_headers
      vendor = json.dig("shop", "vendor")
      expect(vendor["id"]).to eq(shop.vendor_profile.id)
      expect(vendor["display_name"]).to eq(shop.vendor_profile.display_name)
      expect(vendor["verification_status"]).to eq("pending")
      expect(vendor.dig("user", "id")).to eq(shop.vendor_profile.user.id)
      expect(vendor.dig("user", "email")).to eq(shop.vendor_profile.user.email)
      expect(vendor.dig("user", "status")).to eq(shop.vendor_profile.user.status)

      get "/api/v1/admin/shops", headers: admin_auth_headers
      found = json["shops"].find { |s| s["id"] == shop.id }
      expect(found).not_to have_key("vendor")
    end
  end

  describe "PATCH /api/v1/admin/shops/:id" do
    it "updates status and accepting_orders" do
      patch "/api/v1/admin/shops/#{shop.id}", params: { shop: { status: "suspended", accepting_orders: false } },
                                               headers: admin_auth_headers
      expect(json.dig("shop", "status")).to eq("suspended")
      expect(shop.reload.status).to eq("suspended")
    end
  end

  describe "DELETE /api/v1/admin/shops/:id" do
    it "deletes the shop" do
      shop_id = shop.id
      delete "/api/v1/admin/shops/#{shop_id}", headers: admin_auth_headers
      expect(response).to have_http_status(:no_content)
      expect(Shop.find_by(id: shop_id)).to be_nil
    end
  end
end
