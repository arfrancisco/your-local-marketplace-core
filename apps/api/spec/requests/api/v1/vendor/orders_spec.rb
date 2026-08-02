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
  end
end
