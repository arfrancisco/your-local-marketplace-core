require "rails_helper"

RSpec.describe Address, type: :model do
  it { is_expected.to validate_presence_of(:recipient_name) }
  it { is_expected.to validate_presence_of(:building) }

  describe "unit requirement for residents" do
    it "does not require a unit for a non-resident customer" do
      user = create(:user, :customer)
      address = build(:address, user: user, unit: nil)
      expect(address).to be_valid
    end

    it "requires a unit when the customer has claimed residency" do
      user = create(:user, :customer)
      user.customer_profile.update!(is_resident: true, willing_to_verify_residency: true)
      address = build(:address, user: user, unit: nil)
      expect(address).not_to be_valid
      expect(address.errors[:unit]).to be_present
    end

    it "is valid for a resident when a unit is given" do
      user = create(:user, :customer)
      user.customer_profile.update!(is_resident: true, willing_to_verify_residency: true)
      address = build(:address, user: user, unit: "12F")
      expect(address).to be_valid
    end
  end
end
