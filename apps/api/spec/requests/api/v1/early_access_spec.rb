require "rails_helper"

RSpec.describe "Api::V1 Early access", type: :request do
  describe "POST /api/v1/early_access" do
    it "captures a signup without requiring authentication" do
      expect {
        post "/api/v1/early_access", params: { early_access_signup: { email: "new@example.com", name: "Neighbor", interest: "buyer" } }
      }.to change(EarlyAccessSignup, :count).by(1)

      expect(response).to have_http_status(:created)
      expect(json["status"]).to eq("registered")
    end

    it "accepts a mobile number instead of an email" do
      post "/api/v1/early_access", params: { early_access_signup: { mobile_number: "+63 917 555 1234", interest: "seller" } }
      expect(response).to have_http_status(:created)
      expect(EarlyAccessSignup.last.mobile_number).to eq("+639175551234")
    end

    it "treats a repeat email as already-registered, not an error" do
      create(:early_access_signup, email: "dup@example.com")
      expect {
        post "/api/v1/early_access", params: { early_access_signup: { email: "DUP@example.com" } }
      }.not_to change(EarlyAccessSignup, :count)

      expect(response).to have_http_status(:ok)
      expect(json["status"]).to eq("already_registered")
    end

    it "rejects a signup with neither email nor mobile" do
      post "/api/v1/early_access", params: { early_access_signup: { name: "No Contact" } }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "code")).to eq("validation_failed")
    end
  end
end
