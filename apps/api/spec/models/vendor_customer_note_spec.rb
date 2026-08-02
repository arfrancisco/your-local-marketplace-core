require "rails_helper"

RSpec.describe VendorCustomerNote, type: :model do
  it "requires a note body" do
    note = build(:vendor_customer_note, note: nil)
    expect(note).not_to be_valid
    expect(note.errors[:note]).to be_present
  end

  it "is valid with a note body" do
    expect(build(:vendor_customer_note)).to be_valid
  end

  it "allows a note that is not tied to an order" do
    expect(build(:vendor_customer_note, order: nil)).to be_valid
  end

  it "defaults to not flagged" do
    expect(create(:vendor_customer_note).flagged).to be(false)
  end
end
