require "rails_helper"

RSpec.describe "Api::V1::Admin::CustomerProfiles", type: :request do
  before { create(:customer_profile) }

  describe "GET /api/v1/admin/customer_profiles" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/customer_profiles" }

    it_behaves_like "requires admin auth"

    it "lists customer profiles" do
      get "/api/v1/admin/customer_profiles", headers: admin_auth_headers
      expect(json["customer_profiles"]).not_to be_empty
    end

    it "filters by demo" do
      demo_profile = create(:customer_profile, user: create(:user, :demo))

      get "/api/v1/admin/customer_profiles", params: { demo: "true" }, headers: admin_auth_headers
      expect(json["customer_profiles"].map { |cp| cp["id"] }).to eq([demo_profile.id])
    end

    it "filters by residency_verification_status" do
      pending_profile = create(:customer_profile, residency_verification_status: "pending")

      get "/api/v1/admin/customer_profiles", params: { residency_verification_status: "pending" },
                                              headers: admin_auth_headers
      expect(json["customer_profiles"].map { |cp| cp["id"] }).to eq([pending_profile.id])
    end
  end

  describe "POST /api/v1/admin/customer_profiles/:id/verify_residency" do
    it "marks the customer's residency verified" do
      profile = create(:customer_profile, residency_verification_status: "pending")
      post "/api/v1/admin/customer_profiles/#{profile.id}/verify_residency", headers: admin_auth_headers
      expect(json.dig("customer_profile", "residency_verification_status")).to eq("verified")
      expect(profile.reload.residency_verification_status).to eq("verified")
    end
  end

  describe "POST /api/v1/admin/customer_profiles/:id/reject_residency" do
    it "marks the customer's residency rejected" do
      profile = create(:customer_profile, residency_verification_status: "pending")
      post "/api/v1/admin/customer_profiles/#{profile.id}/reject_residency", headers: admin_auth_headers
      expect(profile.reload.residency_verification_status).to eq("rejected")
    end
  end

  describe "POST /api/v1/admin/customer_profiles/:id/clear_cancellation_restriction" do
    it "clears the tier-1 restriction without touching the permanent count" do
      profile = create(:customer_profile, cancellation_restricted_at: Time.current, cancellation_restriction_count: 1)

      post "/api/v1/admin/customer_profiles/#{profile.id}/clear_cancellation_restriction", headers: admin_auth_headers

      expect(json.dig("customer_profile", "cancellation_restricted_at")).to be_nil
      expect(profile.reload.cancellation_restricted_at).to be_nil
      expect(profile.cancellation_restriction_count).to eq(1)
    end
  end
end
