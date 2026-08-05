require "rails_helper"

RSpec.describe User, type: :model do
  subject { build(:user) }

  it { is_expected.to have_secure_password }
  it { is_expected.to validate_presence_of(:email) }
  it { is_expected.to validate_inclusion_of(:status).in_array(User::STATUSES) }

  describe "email normalization and uniqueness" do
    it "downcases and strips the email before saving" do
      user = create(:user, email: "  MixedCase@Example.COM ")
      expect(user.email).to eq("mixedcase@example.com")
    end

    it "rejects a duplicate email regardless of case" do
      create(:user, email: "taken@example.com")
      dup = build(:user, email: "TAKEN@example.com")
      expect(dup).not_to be_valid
      expect(dup.errors[:email]).to be_present
    end

    it "rejects a malformed email" do
      expect(build(:user, email: "not-an-email")).not_to be_valid
    end
  end

  describe "mobile normalization" do
    it "strips non-digit characters but keeps a leading plus" do
      user = create(:user, mobile_number: "+63 (917) 555-1234")
      expect(user.mobile_number).to eq("+639175551234")
    end

    it "treats a blank mobile as nil so multiple users can omit it" do
      create(:user, mobile_number: "")
      expect(build(:user, mobile_number: "   ")).to be_valid
    end
  end

  describe "verification and capability helpers" do
    it "reports verification state from the timestamps" do
      user = build(:user, :verified)
      expect(user).to be_email_verified
      expect(user).to be_mobile_verified
    end

    it "reports capabilities from the presence of profiles" do
      user = create(:user, :customer)
      expect(user).to be_customer
      expect(user).not_to be_vendor
    end
  end

  describe "demo/real scopes" do
    it "splits users by the demo flag" do
      demo_user = create(:user, :demo)
      real_user = create(:user)

      expect(User.demo).to contain_exactly(demo_user)
      expect(User.real).to contain_exactly(real_user)
    end
  end
end
