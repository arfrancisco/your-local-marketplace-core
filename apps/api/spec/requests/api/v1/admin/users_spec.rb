require "rails_helper"

RSpec.describe "Api::V1::Admin::Users", type: :request do
  let(:user) { create(:user) }

  describe "GET /api/v1/admin/users" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/users" }

    it_behaves_like "requires admin auth"

    it "lists users, filterable by status and a search query" do
      create(:user, :suspended, email: "flagged@example.com")
      create(:user, email: "someone@example.com")

      get "/api/v1/admin/users", params: { status: "suspended" }, headers: admin_auth_headers
      expect(json["users"].map { |u| u["email"] }).to eq(["flagged@example.com"])

      get "/api/v1/admin/users", params: { q: "someone" }, headers: admin_auth_headers
      expect(json["users"].map { |u| u["email"] }).to eq(["someone@example.com"])
    end

    it "filters by demo and reports the demo flag" do
      demo_user = create(:user, :demo, email: "demo@example.com")
      create(:user, email: "real@example.com")
      user # force the lazy let to create before either request fires

      get "/api/v1/admin/users", params: { demo: "true" }, headers: admin_auth_headers
      expect(json["users"].map { |u| u["email"] }).to eq(["demo@example.com"])
      expect(json["users"].first["demo"]).to eq(true)

      get "/api/v1/admin/users", params: { demo: "false" }, headers: admin_auth_headers
      expect(json["users"].map { |u| u["email"] }).to contain_exactly("real@example.com", user.email)
      expect(json["users"].none? { |u| u["id"] == demo_user.id }).to be true
    end
  end

  describe "POST /api/v1/admin/users/:id/suspend" do
    it "suspends the user" do
      post "/api/v1/admin/users/#{user.id}/suspend", headers: admin_auth_headers
      expect(response).to have_http_status(:ok)
      expect(json.dig("user", "status")).to eq("suspended")
      expect(user.reload.status).to eq("suspended")
    end
  end

  describe "POST /api/v1/admin/users/:id/reactivate" do
    it "reactivates a suspended user" do
      user.update!(status: "suspended")
      post "/api/v1/admin/users/#{user.id}/reactivate", headers: admin_auth_headers
      expect(json.dig("user", "status")).to eq("active")
      expect(user.reload.status).to eq("active")
    end
  end
end
