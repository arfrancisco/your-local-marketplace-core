require "rails_helper"

RSpec.describe "Api::V1::Admin::Sessions", type: :request do
  describe "POST /api/v1/admin/auth/login" do
    it "logs in with correct credentials and returns a token" do
      create(:admin_user, email: "ops@example.com", password: "sup3rsecret")

      post "/api/v1/admin/auth/login", params: { email: "ops@example.com", password: "sup3rsecret" }

      expect(response).to have_http_status(:created)
      expect(json["token"]).to be_present
      expect(json.dig("admin_user", "email")).to eq("ops@example.com")
      expect(json["admin_user"]).not_to have_key("password_digest")
    end

    it "updates last_signed_in_at" do
      admin_user = create(:admin_user, password: "sup3rsecret")

      expect {
        post "/api/v1/admin/auth/login", params: { email: admin_user.email, password: "sup3rsecret" }
      }.to change { admin_user.reload.last_signed_in_at }.from(nil)
    end

    it "rejects the wrong password without revealing which part was wrong" do
      admin_user = create(:admin_user, password: "sup3rsecret")

      post "/api/v1/admin/auth/login", params: { email: admin_user.email, password: "wrong" }

      expect(response).to have_http_status(:unauthorized)
      expect(json.dig("error", "message")).to eq("Invalid email or password")
    end

    it "rejects an unknown email with the same message (no enumeration)" do
      post "/api/v1/admin/auth/login", params: { email: "nobody@example.com", password: "whatever" }

      expect(response).to have_http_status(:unauthorized)
      expect(json.dig("error", "message")).to eq("Invalid email or password")
    end

    it "rejects a suspended admin" do
      admin_user = create(:admin_user, :suspended, password: "sup3rsecret")

      post "/api/v1/admin/auth/login", params: { email: admin_user.email, password: "sup3rsecret" }

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/admin/auth/logout" do
    it "revokes the current token so it no longer authenticates" do
      admin_user = create(:admin_user)
      headers = admin_auth_headers(admin_user)

      post "/api/v1/admin/auth/logout", headers: headers
      expect(response).to have_http_status(:no_content)

      get "/api/v1/admin/admin_users", headers: headers
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
