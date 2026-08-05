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
