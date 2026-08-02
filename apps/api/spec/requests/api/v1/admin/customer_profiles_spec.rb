require "rails_helper"

RSpec.describe "Api::V1::Admin::CustomerProfiles", type: :request do
  before { create(:customer_profile) }

  describe "GET /api/v1/admin/customer_profiles" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/customer_profiles" }

    it_behaves_like "requires admin basic auth"

    it "lists customer profiles" do
      get "/api/v1/admin/customer_profiles", headers: admin_auth_headers
      expect(json["customer_profiles"]).not_to be_empty
    end
  end
end
