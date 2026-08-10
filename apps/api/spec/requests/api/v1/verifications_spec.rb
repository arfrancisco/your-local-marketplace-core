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

  describe "per-user rate limiting" do
    it "rejects a second send within the cooldown window" do
      post "/api/v1/verifications/email", headers: auth_headers(user)
      post "/api/v1/verifications/email", headers: auth_headers(user)
      expect(response).to have_http_status(:too_many_requests)
      expect(json.dig("error", "code")).to eq("rate_limited")
    end

    it "allows a resend once the cooldown has passed" do
      post "/api/v1/verifications/email", headers: auth_headers(user)
      travel(Verifications::IssueChallenge::COOLDOWN + 1.second)
      post "/api/v1/verifications/email", headers: auth_headers(user)
      expect(response).to have_http_status(:accepted)
    end

    it "caps sends at MAX_PER_HOUR even outside the cooldown window" do
      Verifications::IssueChallenge::MAX_PER_HOUR.times do
        post "/api/v1/verifications/email", headers: auth_headers(user)
        travel(Verifications::IssueChallenge::COOLDOWN + 1.second)
      end
      post "/api/v1/verifications/email", headers: auth_headers(user)
      expect(response).to have_http_status(:too_many_requests)
    end
  end

  describe "per-destination rate limiting" do
    it "caps sends to the same email address even across different accounts" do
      other_user = create(:user, email: "previously-held-this-address@example.com")
      # Simulate MAX_PER_HOUR prior sends to user's exact email address, but
      # attached to a *different* account -- e.g. the address was freed and
      # later claimed by `user`. The per-user cap alone can't see this, since
      # it's scoped to the requesting user, not the destination.
      Verifications::IssueChallenge::MAX_PER_HOUR.times do
        VerificationChallenge.issue!(
          user: other_user, channel: "email", purpose: "email_verification", sent_to: user.email
        )
      end

      post "/api/v1/verifications/email", headers: auth_headers(user)
      expect(response).to have_http_status(:too_many_requests)
      expect(json.dig("error", "code")).to eq("rate_limited")
    end
  end
end
