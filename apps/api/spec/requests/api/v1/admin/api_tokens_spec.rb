require "rails_helper"

RSpec.describe "Api::V1::Admin::ApiTokens", type: :request do
  let(:user) { create(:user) }
  let!(:api_token_record) { ApiToken.issue!(user).first }

  describe "GET /api/v1/admin/api_tokens" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/api_tokens" }

    it_behaves_like "requires admin auth"

    it "never leaks the token digest" do
      get "/api/v1/admin/api_tokens", headers: admin_auth_headers
      expect(json["api_tokens"].first.keys).not_to include("token_digest")
    end
  end

  describe "DELETE /api/v1/admin/api_tokens/:id" do
    it "soft-revokes by expiring the token, without deleting the row" do
      _record, raw = ApiToken.issue!(user)
      token = ApiToken.authenticate(raw)

      delete "/api/v1/admin/api_tokens/#{token.id}", headers: admin_auth_headers
      expect(response).to have_http_status(:ok)
      expect(json.dig("api_token", "revoked")).to be(true)

      expect(ApiToken.authenticate(raw)).to be_nil
      expect(ApiToken.find(token.id)).to be_present
    end
  end
end
