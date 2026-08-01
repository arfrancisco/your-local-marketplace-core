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
end
