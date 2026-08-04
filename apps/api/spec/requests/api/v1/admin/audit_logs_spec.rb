require "rails_helper"

RSpec.describe "Api::V1::Admin::AuditLogs", type: :request do
  describe "GET /api/v1/admin/audit_logs" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/audit_logs" }

    it_behaves_like "requires admin auth"

    it "does not create a row for a read-only request" do
      expect {
        get "/api/v1/admin/audit_logs", headers: admin_auth_headers
      }.not_to change(AdminAuditLog, :count)
    end
  end

  describe "attribution" do
    it "records a mutating admin request with the correct admin, method, path, and resource" do
      actor = create(:admin_user, email: "ops@example.com")
      user = create(:user, :suspended)

      expect {
        post "/api/v1/admin/users/#{user.id}/reactivate", headers: admin_auth_headers(actor)
      }.to change(AdminAuditLog, :count).by(1)

      log = AdminAuditLog.last
      expect(log.admin_user).to eq(actor)
      expect(log.http_method).to eq("POST")
      expect(log.path).to eq("/api/v1/admin/users/#{user.id}/reactivate")
      expect(log.resource_type).to eq("User")
      expect(log.resource_id).to eq(user.id)
      expect(log.status_code).to eq(200)
    end
  end

  describe "GET /api/v1/admin/audit_logs/:id" do
    it "shows a single audit log entry" do
      actor = create(:admin_user)
      user = create(:user)
      post "/api/v1/admin/users/#{user.id}/suspend", headers: admin_auth_headers(actor)
      log = AdminAuditLog.last

      get "/api/v1/admin/audit_logs/#{log.id}", headers: admin_auth_headers

      expect(response).to have_http_status(:ok)
      expect(json.dig("audit_log", "id")).to eq(log.id)
    end
  end

  describe "filtering" do
    it "filters by admin_user_id and by resource_type" do
      actor = create(:admin_user)
      other = create(:admin_user)
      user = create(:user)
      post "/api/v1/admin/users/#{user.id}/suspend", headers: admin_auth_headers(actor)
      post "/api/v1/admin/users/#{user.id}/reactivate", headers: admin_auth_headers(other)

      get "/api/v1/admin/audit_logs", params: { admin_user_id: actor.id }, headers: admin_auth_headers
      expect(json["audit_logs"]).to be_present
      expect(json["audit_logs"].map { |l| l["admin_user_id"] }).to all(eq(actor.id))

      get "/api/v1/admin/audit_logs", params: { resource_type: "User" }, headers: admin_auth_headers
      expect(json["audit_logs"]).to be_present
      expect(json["audit_logs"].map { |l| l["resource_type"] }).to all(eq("User"))
    end
  end
end
