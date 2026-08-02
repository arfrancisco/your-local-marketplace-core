require "rails_helper"

RSpec.describe "Api::V1::Admin::Carts", type: :request do
  before { create(:cart, status: "active") }

  describe "GET /api/v1/admin/carts" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/carts" }

    it_behaves_like "requires admin basic auth"

    it "filters by status" do
      create(:cart, status: "abandoned")
      get "/api/v1/admin/carts", params: { status: "abandoned" }, headers: admin_auth_headers
      expect(json["carts"].size).to eq(1)
      expect(json["carts"].first["status"]).to eq("abandoned")
    end
  end
end
