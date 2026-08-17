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

    # QA review flagged that the two specs above only prove the *output* is
    # correct, which held true even under the old per-order computation (same
    # shop, same aggregate, either way) — so neither would fail if the
    # hoisting were silently reverted. These count actual SQL queries against
    # the tables involved, which would fail under the old code.
    it "queries the shop's rating aggregate/count exactly once per request, not once per order" do
      5.times { create(:order, shop: shop_a, customer_profile: customer.customer_profile) }
      create(:rating, order: Order.where(shop: shop_a).first, reviewer_user: customer, reviewee: shop_a, score: 4)

      average_queries = 0
      count_queries = 0
      callback = lambda do |*, payload|
        sql = payload[:sql]
        next unless sql.include?('"ratings"') && sql.exclude?("order_id")
        average_queries += 1 if sql.match?(/\ASELECT AVG/i)
        count_queries += 1 if sql.match?(/\ASELECT COUNT/i)
      end

      ActiveSupport::Notifications.subscribed(callback, "sql.active_record") do
        get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      end

      expect(response).to have_http_status(:ok)
      expect(average_queries).to eq(1)
      expect(count_queries).to eq(1)
    end

    it "batches each rated order's reviewer_user/customer_profile lookup, not one pair of queries per rated order" do
      users_and_customer_profiles_query_count = lambda do |&block|
        counts = { users: 0, customer_profiles: 0 }
        callback = lambda do |*, payload|
          sql = payload[:sql]
          counts[:users] += 1 if sql.match?(/\ASELECT.*FROM "users"/i)
          counts[:customer_profiles] += 1 if sql.match?(/\ASELECT.*FROM "customer_profiles"/i)
        end
        ActiveSupport::Notifications.subscribed(callback, "sql.active_record", &block)
        counts
      end

      order_one = create(:order, shop: shop_a, customer_profile: customer.customer_profile)
      create(:rating, order: order_one, reviewer_user: customer, reviewee: shop_a, score: 5)
      counts_with_one_rated_order = users_and_customer_profiles_query_count.call do
        get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      end
      expect(response).to have_http_status(:ok)

      # 4 more rated orders, each by a distinct reviewer — if reviewer_user/
      # customer_profile weren't batched, this would fire 4 more query pairs.
      4.times do
        reviewer = create(:user, :customer)
        order = create(:order, shop: shop_a, customer_profile: reviewer.customer_profile)
        create(:rating, order: order, reviewer_user: reviewer, reviewee: shop_a, score: 3)
      end
      counts_with_five_rated_orders = users_and_customer_profiles_query_count.call do
        get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      end
      expect(response).to have_http_status(:ok)

      expect(counts_with_five_rated_orders).to eq(counts_with_one_rated_order)
    end
  end
end
