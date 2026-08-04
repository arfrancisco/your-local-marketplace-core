require "rails_helper"

RSpec.describe AdminUser, type: :model do
  subject { build(:admin_user) }

  it { is_expected.to have_secure_password }
  it { is_expected.to validate_presence_of(:email) }
  it { is_expected.to validate_inclusion_of(:status).in_array(AdminUser::STATUSES) }

  describe "email normalization and uniqueness" do
    it "downcases and strips the email before saving" do
      admin_user = create(:admin_user, email: "  MixedCase@Example.COM ")
      expect(admin_user.email).to eq("mixedcase@example.com")
    end

    it "rejects a duplicate email regardless of case" do
      create(:admin_user, email: "taken@example.com")
      dup = build(:admin_user, email: "TAKEN@example.com")
      expect(dup).not_to be_valid
      expect(dup.errors[:email]).to be_present
    end

    it "rejects a malformed email" do
      expect(build(:admin_user, email: "not-an-email")).not_to be_valid
    end
  end

  describe "#active?" do
    it "is true for an active admin and false for a suspended one" do
      expect(build(:admin_user)).to be_active
      expect(build(:admin_user, :suspended)).not_to be_active
    end
  end
end
