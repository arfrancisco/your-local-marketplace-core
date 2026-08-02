require "rails_helper"

RSpec.describe "Api::V1::Admin::Shops", type: :request do
  let(:shop) { create(:shop) }

  describe "GET /api/v1/admin/shops" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/shops" }

    it_behaves_like "requires admin basic auth"

    it "includes payment/opening-message info unlike public discovery" do
      shop.update!(opening_message: "GCash to 0917-000-0000")
      get "/api/v1/admin/shops", headers: admin_auth_headers
      found = json["shops"].find { |s| s["id"] == shop.id }
      expect(found["opening_message"]).to eq("GCash to 0917-000-0000")
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
