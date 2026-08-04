require "rails_helper"

RSpec.describe "Api::V1::Admin::AdminUsers", type: :request do
  describe "GET /api/v1/admin/admin_users" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/admin_users" }

    it_behaves_like "requires admin auth"

    it "lists admin users" do
      create(:admin_user, email: "a@example.com")
      create(:admin_user, email: "b@example.com")

      get "/api/v1/admin/admin_users", headers: admin_auth_headers
      expect(json["admin_users"].map { |a| a["email"] }).to include("a@example.com", "b@example.com")
    end
  end

  describe "POST /api/v1/admin/admin_users" do
    let(:request_method) { :post }
    let(:request_path) { "/api/v1/admin/admin_users" }
    let(:request_params) { { admin_user: { email: "new@example.com", password: "sup3rsecret" } } }

    it_behaves_like "requires admin auth"

    it "creates a new admin user" do
      post "/api/v1/admin/admin_users",
           params: { admin_user: { email: "new@example.com", password: "sup3rsecret", first_name: "New" } },
           headers: admin_auth_headers

      expect(response).to have_http_status(:created)
      expect(json.dig("admin_user", "email")).to eq("new@example.com")
      expect(json["admin_user"]).not_to have_key("password_digest")
    end
  end

  describe "POST /api/v1/admin/admin_users/:id/deactivate" do
    it "suspends the admin and immediately expires their active tokens" do
      actor = create(:admin_user)
      target = create(:admin_user)
      _record, raw = AdminApiToken.issue!(target)

      post "/api/v1/admin/admin_users/#{target.id}/deactivate", headers: admin_auth_headers(actor)

      expect(response).to have_http_status(:ok)
      expect(json.dig("admin_user", "status")).to eq("suspended")
      expect(target.reload.status).to eq("suspended")
      expect(AdminApiToken.authenticate(raw)).to be_nil
    end

    it "does not let an admin deactivate their own account" do
      actor = create(:admin_user)

      post "/api/v1/admin/admin_users/#{actor.id}/deactivate", headers: admin_auth_headers(actor)

      expect(response).to have_http_status(:unprocessable_entity)
      expect(actor.reload.status).to eq("active")
    end
  end

  describe "POST /api/v1/admin/admin_users/:id/reactivate" do
    it "reactivates a suspended admin" do
      target = create(:admin_user, :suspended)

      post "/api/v1/admin/admin_users/#{target.id}/reactivate", headers: admin_auth_headers

      expect(json.dig("admin_user", "status")).to eq("active")
      expect(target.reload.status).to eq("active")
    end
  end
end
