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
      expect(json_order["customer_building"]).to eq("Tower A")
      expect(json_order["customer_unit"]).to eq("12F")
    end

    it "returns nil building/unit when the customer has no default address on file" do
      order_a = create(:order, shop: shop_a, customer_profile: customer.customer_profile)

      get "/api/v1/vendor/orders", headers: auth_headers(vendor_user)
      json_order = json["orders"].find { |o| o["id"] == order_a.id }

      expect(json_order["customer_building"]).to be_nil
      expect(json_order["customer_unit"]).to be_nil
    end
  end
end
