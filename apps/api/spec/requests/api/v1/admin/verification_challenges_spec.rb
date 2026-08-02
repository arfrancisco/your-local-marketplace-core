require "rails_helper"

RSpec.describe "Api::V1::Admin::VerificationChallenges", type: :request do
  let(:user) { create(:user) }

  before { VerificationChallenge.issue!(user: user, channel: "email", purpose: "email_verification", sent_to: user.email) }

  describe "GET /api/v1/admin/verification_challenges" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/verification_challenges" }

    it_behaves_like "requires admin basic auth"

    it "never leaks the code digest" do
      get "/api/v1/admin/verification_challenges", headers: admin_auth_headers
      expect(json["verification_challenges"].first.keys).not_to include("code_digest")
    end

    it "filters by user_id" do
      other_user = create(:user)
      VerificationChallenge.issue!(user: other_user, channel: "sms", purpose: "mobile_verification", sent_to: "+639170001111")

      get "/api/v1/admin/verification_challenges", params: { user_id: user.id }, headers: admin_auth_headers
      expect(json["verification_challenges"].size).to eq(1)
      expect(json["verification_challenges"].first["user_id"]).to eq(user.id)
    end
  end
end
