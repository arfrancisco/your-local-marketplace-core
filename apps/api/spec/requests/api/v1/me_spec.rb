require "rails_helper"

RSpec.describe "Api::V1 Me", type: :request do
  let(:user) { create(:user, :customer, :verified) }

  describe "GET /api/v1/me" do
    it "returns the current user's profile" do
      get "/api/v1/me", headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      expect(json.dig("user", "id")).to eq(user.id)
      expect(json.dig("user", "customer_profile")).to be_present
      expect(json["user"]).not_to have_key("password_digest")
    end
  end

  describe "PATCH /api/v1/me" do
    it "updates the display name across profiles" do
      patch "/api/v1/me", params: { user: { display_name: "Renamed" } }, headers: auth_headers(user)
      expect(response).to have_http_status(:ok)
      expect(user.customer_profile.reload.display_name).to eq("Renamed")
    end

    it "clears email verification when the email changes" do
      patch "/api/v1/me", params: { user: { email: "changed@example.com" } }, headers: auth_headers(user)
      expect(user.reload.email).to eq("changed@example.com")
      expect(user).not_to be_email_verified
    end
  end
end
