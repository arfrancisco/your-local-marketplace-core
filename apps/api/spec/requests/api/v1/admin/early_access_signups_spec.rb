require "rails_helper"

RSpec.describe "Api::V1::Admin::EarlyAccessSignups", type: :request do
  let(:signup) { create(:early_access_signup) }

  describe "GET /api/v1/admin/early_access_signups" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/early_access_signups" }

    it_behaves_like "requires admin basic auth"
  end

  describe "DELETE /api/v1/admin/early_access_signups/:id" do
    it "deletes the signup" do
      signup_id = signup.id
      delete "/api/v1/admin/early_access_signups/#{signup_id}", headers: admin_auth_headers
      expect(response).to have_http_status(:no_content)
      expect(EarlyAccessSignup.find_by(id: signup_id)).to be_nil
    end
  end
end
