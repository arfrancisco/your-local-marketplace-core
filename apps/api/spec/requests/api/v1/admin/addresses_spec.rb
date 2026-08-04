require "rails_helper"

RSpec.describe "Api::V1::Admin::Addresses", type: :request do
  let(:user) { create(:user) }
  before { create(:address, user: user) }

  describe "GET /api/v1/admin/addresses" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/addresses" }

    it_behaves_like "requires admin auth"

    it "filters by user_id" do
      create(:address, user: create(:user))
      get "/api/v1/admin/addresses", params: { user_id: user.id }, headers: admin_auth_headers
      expect(json["addresses"].size).to eq(1)
    end
  end
end
