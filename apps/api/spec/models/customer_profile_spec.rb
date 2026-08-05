require "rails_helper"

RSpec.describe CustomerProfile, type: :model do
  subject { build(:customer_profile) }

  it { is_expected.to validate_presence_of(:display_name) }

  describe "residency consent invariant" do
    it "is valid when not claiming residency" do
      profile = build(:customer_profile, is_resident: false)
      expect(profile).to be_valid
    end

    it "is invalid claiming residency without agreeing to verification" do
      profile = build(:customer_profile, is_resident: true, willing_to_verify_residency: nil)
      expect(profile).not_to be_valid
      expect(profile.errors[:willing_to_verify_residency]).to be_present
    end

    it "is invalid claiming residency while explicitly declining verification" do
      profile = build(:customer_profile, is_resident: true, willing_to_verify_residency: false)
      expect(profile).not_to be_valid
    end

    it "is valid claiming residency and agreeing to verification" do
      profile = build(:customer_profile, is_resident: true, willing_to_verify_residency: true)
      expect(profile).to be_valid
    end
  end

  describe "residency_verification_status" do
    it { is_expected.to validate_inclusion_of(:residency_verification_status).in_array(CustomerProfile::RESIDENCY_VERIFICATION_STATUSES) }

    it "defaults to unverified" do
      expect(create(:customer_profile).residency_verification_status).to eq("unverified")
    end

    it "reports residency_verified? only once verified" do
      profile = create(:customer_profile, residency_verification_status: "pending")
      expect(profile).not_to be_residency_verified
      profile.update!(residency_verification_status: "verified")
      expect(profile).to be_residency_verified
    end
  end

  describe "demo/real derivation" do
    it "delegates to the owning user's demo flag" do
      demo_profile = create(:customer_profile, user: create(:user, :demo))
      real_profile = create(:customer_profile)

      expect(demo_profile).to be_demo
      expect(real_profile).not_to be_demo
      expect(CustomerProfile.demo).to contain_exactly(demo_profile)
      expect(CustomerProfile.real).to contain_exactly(real_profile)
    end
  end
end
