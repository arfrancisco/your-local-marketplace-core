require "rails_helper"

RSpec.describe "Api::V1 PasswordResets", type: :request do
  let(:user) { create(:user, email: "resetme@example.com", password: "old-password") }

  describe "POST /api/v1/password_resets" do
    it "returns the same generic response for an existing email" do
      expect {
        post "/api/v1/password_resets", params: { email: user.email }
      }.to have_enqueued_job(VerificationDeliveryJob)
      expect(response).to have_http_status(:accepted)
    end

    it "returns the identical generic response for a non-existent email" do
      expect {
        post "/api/v1/password_resets", params: { email: "ghost@example.com" }
      }.not_to have_enqueued_job(VerificationDeliveryJob)
      expect(response).to have_http_status(:accepted)
      expect(json["message"]).to eq("If an account exists with that email, we've sent a reset code.")
    end
  end

  describe "POST /api/v1/password_resets/confirm" do
    def request_code
      post "/api/v1/password_resets", params: { email: user.email }
      enqueued_jobs.last["arguments"].last
    end

    it "resets the password with a valid code" do
      code = request_code
      post "/api/v1/password_resets/confirm",
           params: { email: user.email, code: code, new_password: "brand-new-password" }
      expect(response).to have_http_status(:ok)
      expect(user.reload.authenticate("brand-new-password")).to be_truthy
    end

    it "revokes existing API tokens on a successful reset" do
      _record, raw = ApiToken.issue!(user)
      code = request_code
      post "/api/v1/password_resets/confirm",
           params: { email: user.email, code: code, new_password: "brand-new-password" }
      expect(ApiToken.authenticate(raw)).to be_nil
    end

    it "rejects a wrong code with the generic message" do
      request_code
      post "/api/v1/password_resets/confirm",
           params: { email: user.email, code: "000000", new_password: "brand-new-password" }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "message")).to eq("Invalid or expired code")
      expect(user.reload.authenticate("old-password")).to be_truthy
    end

    it "gives the same generic message for a non-existent email (no enumeration)" do
      post "/api/v1/password_resets/confirm",
           params: { email: "ghost@example.com", code: "123456", new_password: "brand-new-password" }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "message")).to eq("Invalid or expired code")
    end
  end
end
