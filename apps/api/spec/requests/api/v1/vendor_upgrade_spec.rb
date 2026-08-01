require "rails_helper"

RSpec.describe "Api::V1 Vendor upgrade", type: :request do
  let(:user) { create(:user, :customer, :email_verified) }

  def make_eligible!(user)
    user.customer_profile.update!(is_resident: true, willing_to_verify_residency: true)
  end

  describe "GET /api/v1/me reflects vendor_eligibility" do
    it "is ineligible by default (not resident, email may be unverified)" do
      ineligible_user = create(:user, :customer)
      get "/api/v1/me", headers: auth_headers(ineligible_user)
      eligibility = json.dig("user", "vendor_eligibility")
      expect(eligibility["eligible"]).to eq(false)
      expect(eligibility["reasons"]).to include("not_resident", "email_not_verified")
    end

    it "is eligible once every requirement is met" do
      make_eligible!(user)
      get "/api/v1/me", headers: auth_headers(user)
      eligibility = json.dig("user", "vendor_eligibility")
      expect(eligibility["eligible"]).to eq(true)
      expect(eligibility["reasons"]).to eq([])
    end
  end

  describe "POST /api/v1/me/vendor_profile" do
    it "creates a vendor profile for an eligible user" do
      make_eligible!(user)
      user.update!(first_name: "Juan", last_name: "Dela Cruz")

      expect { post "/api/v1/me/vendor_profile", headers: auth_headers(user) }
        .to change(VendorProfile, :count).by(1)
      expect(response).to have_http_status(:created)
      expect(user.reload.vendor_profile.display_name).to eq("Juan Dela Cruz")
    end

    it "blocks a non-resident with the correct reason" do
      post "/api/v1/me/vendor_profile", headers: auth_headers(user)
      expect(response).to have_http_status(:forbidden)
      expect(json.dig("error", "details", "reasons")).to include("not_resident")
    end

    it "blocks an unverified email with the correct reason" do
      make_eligible!(user)
      user.update_column(:email_verified_at, nil)
      post "/api/v1/me/vendor_profile", headers: auth_headers(user)
      expect(response).to have_http_status(:forbidden)
      expect(json.dig("error", "details", "reasons")).to include("email_not_verified")
    end

    it "blocks an already-vendor account" do
      make_eligible!(user)
      user.create_vendor_profile!(display_name: "Existing Vendor")
      post "/api/v1/me/vendor_profile", headers: auth_headers(user)
      expect(response).to have_http_status(:forbidden)
      expect(json.dig("error", "details", "reasons")).to include("already_vendor")
    end
  end
end
