require "rails_helper"

RSpec.describe "Api::V1::Admin::VendorProfiles", type: :request do
  let(:vendor_profile) { create(:vendor_profile) }

  describe "GET /api/v1/admin/vendor_profiles" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/vendor_profiles" }

    it_behaves_like "requires admin auth"

    it "filters by verification_status" do
      create(:vendor_profile, verification_status: "pending")
      vendor_profile.update!(verification_status: "verified")

      get "/api/v1/admin/vendor_profiles", params: { verification_status: "pending" }, headers: admin_auth_headers
      expect(json["vendor_profiles"].size).to eq(1)
      expect(json["vendor_profiles"].first["verification_status"]).to eq("pending")
    end
  end

  describe "POST /api/v1/admin/vendor_profiles/:id/approve" do
    it "marks the vendor profile verified — first real writer of this dormant column" do
      post "/api/v1/admin/vendor_profiles/#{vendor_profile.id}/approve", headers: admin_auth_headers
      expect(json.dig("vendor_profile", "verification_status")).to eq("verified")
      expect(vendor_profile.reload.verification_status).to eq("verified")
    end
  end

  describe "POST /api/v1/admin/vendor_profiles/:id/reject" do
    it "marks the vendor profile rejected" do
      post "/api/v1/admin/vendor_profiles/#{vendor_profile.id}/reject", headers: admin_auth_headers
      expect(vendor_profile.reload.verification_status).to eq("rejected")
    end
  end

  describe "POST /api/v1/admin/vendor_profiles/:id/clear_cancellation_restriction" do
    it "clears the tier-1 restriction without touching the permanent count, and does not reopen the shop" do
      restricted = create(:vendor_profile, cancellation_restricted_at: Time.current, cancellation_restriction_count: 1)
      shop = create(:shop, vendor_profile: restricted, accepting_orders: false)

      post "/api/v1/admin/vendor_profiles/#{restricted.id}/clear_cancellation_restriction", headers: admin_auth_headers

      expect(json.dig("vendor_profile", "cancellation_restricted_at")).to be_nil
      expect(restricted.reload.cancellation_restricted_at).to be_nil
      expect(restricted.cancellation_restriction_count).to eq(1)
      expect(shop.reload.accepting_orders).to be(false)
    end
  end
end
