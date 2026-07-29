require "rails_helper"

RSpec.describe "Api::V1 Verifications", type: :request do
  let(:user) { create(:user, mobile_number: "+639170000000") }

  describe "email verification flow" do
    it "sends a code, enqueues delivery, and confirms to verify the email" do
      expect {
        post "/api/v1/verifications/email", headers: auth_headers(user)
      }.to have_enqueued_job(VerificationDeliveryJob)
      expect(response).to have_http_status(:accepted)

      # The plaintext code lives only in the enqueued job args, never in the DB.
      code = enqueued_jobs.last["arguments"].last
      post "/api/v1/verifications/email/confirm", params: { code: code }, headers: auth_headers(user)

      expect(response).to have_http_status(:ok)
      expect(user.reload).to be_email_verified
    end

    it "rejects a wrong code without verifying" do
      post "/api/v1/verifications/email", headers: auth_headers(user)
      post "/api/v1/verifications/email/confirm", params: { code: "000000" }, headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(user.reload).not_to be_email_verified
    end
  end

  describe "mobile verification" do
    it "refuses to send when the user has no mobile on file" do
      user.update_column(:mobile_number, nil)
      post "/api/v1/verifications/mobile", headers: auth_headers(user)
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "verifies the mobile number end to end" do
      post "/api/v1/verifications/mobile", headers: auth_headers(user)
      code = enqueued_jobs.last["arguments"].last
      post "/api/v1/verifications/mobile/confirm", params: { code: code }, headers: auth_headers(user)
      expect(user.reload).to be_mobile_verified
    end
  end

  it "requires authentication" do
    post "/api/v1/verifications/email"
    expect(response).to have_http_status(:unauthorized)
  end
end
