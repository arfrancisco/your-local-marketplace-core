require "rails_helper"

RSpec.describe "Api::V1 TestHelpers", type: :request do
  let(:user) { create(:user, mobile_number: "+639170000099") }

  describe "GET /api/v1/test_helpers/verification_code" do
    it "returns the real code for a live email_verification challenge" do
      post "/api/v1/verifications/email", headers: auth_headers(user)
      real_code = enqueued_jobs.last["arguments"].last

      get "/api/v1/test_helpers/verification_code",
          params: { email: user.email, purpose: "email_verification" }
      expect(response).to have_http_status(:ok)
      expect(json["code"]).to eq(real_code)
    end

    it "returns the real code for a live password_reset challenge" do
      post "/api/v1/password_resets", params: { email: user.email }
      real_code = enqueued_jobs.last["arguments"].last

      get "/api/v1/test_helpers/verification_code",
          params: { email: user.email, purpose: "password_reset" }
      expect(response).to have_http_status(:ok)
      expect(json["code"]).to eq(real_code)
    end

    it "404s for an unknown email" do
      get "/api/v1/test_helpers/verification_code",
          params: { email: "ghost@example.com", purpose: "email_verification" }
      expect(response).to have_http_status(:not_found)
    end

    it "404s for an invalid purpose" do
      get "/api/v1/test_helpers/verification_code",
          params: { email: user.email, purpose: "not_a_real_purpose" }
      expect(response).to have_http_status(:not_found)
    end

    it "404s when no code has been issued yet" do
      get "/api/v1/test_helpers/verification_code",
          params: { email: user.email, purpose: "mobile_verification" }
      expect(response).to have_http_status(:not_found)
    end

    it "404s once TestHelperAccess is disabled, even in this env" do
      allow(TestHelperAccess).to receive(:enabled?).and_return(false)
      post "/api/v1/verifications/email", headers: auth_headers(user)

      get "/api/v1/test_helpers/verification_code",
          params: { email: user.email, purpose: "email_verification" }
      expect(response).to have_http_status(:not_found)
    end
  end
end
