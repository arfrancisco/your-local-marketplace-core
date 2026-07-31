require "rails_helper"

RSpec.describe "Api::V1::Vendor Orders", type: :request do
  let(:vendor_user) { create(:user, :vendor) }
  let(:shop_a) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile) }
  let(:shop_b) { create(:shop, :open, vendor_profile: vendor_user.vendor_profile) }
  let(:customer) { create(:user, :customer) }

  describe "GET /api/v1/vendor/orders" do
    it "returns orders across all of the vendor's shops" do
      order_a = create(:order, shop: shop_a, customer_profile: customer.customer_profile)
      order_b = create(:order, shop: shop_b, customer_profile: customer.customer_profile)

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      expect(response).to have_http_status(:ok)
      expect(json["orders"].map { |o| o["id"] }).to contain_exactly(order_a.id, order_b.id)
    end

    it "filters to one shop when shop_id is given" do
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
