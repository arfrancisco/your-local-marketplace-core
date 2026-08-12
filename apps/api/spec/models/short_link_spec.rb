require "rails_helper"

RSpec.describe ShortLink, type: :model do
  describe "#generate_code" do
    it "assigns a unique code on create" do
      short_link = ShortLink.for(order: create(:order), audience: "customer")

      expect(short_link.code).to be_present
      expect(short_link.code.length).to eq(7)
    end

    it "never collides with an existing code" do
      existing = ShortLink.for(order: create(:order), audience: "customer")
      allow(SecureRandom).to receive(:alphanumeric).and_return(existing.code, "freshcode")

      new_link = ShortLink.for(order: create(:order), audience: "vendor")

      expect(new_link.code).to eq("freshcode")
    end
  end

  describe ".for" do
    it "reuses the existing code for the same order+audience instead of minting a new one" do
      order = create(:order)

      first = ShortLink.for(order: order, audience: "customer")
      second = ShortLink.for(order: order, audience: "customer")

      expect(second.id).to eq(first.id)
      expect(second.code).to eq(first.code)
    end

    it "creates distinct links for the same order across audiences" do
      order = create(:order)

      customer_link = ShortLink.for(order: order, audience: "customer")
      vendor_link = ShortLink.for(order: order, audience: "vendor")

      expect(customer_link.code).not_to eq(vendor_link.code)
    end
  end

  describe "#target_path" do
    it "points at the customer order page for a customer audience" do
      order = create(:order)
      short_link = ShortLink.for(order: order, audience: "customer")

      expect(short_link.target_path).to eq("/orders/#{order.id}")
    end

    it "points at the vendor order page for a vendor audience" do
      order = create(:order)
      short_link = ShortLink.for(order: order, audience: "vendor")

      expect(short_link.target_path).to eq("/vendor/orders/#{order.id}")
    end
  end

  describe "validations" do
    it "rejects an unknown audience" do
      short_link = ShortLink.new(order: create(:order), audience: "courier")

      expect(short_link).not_to be_valid
      expect(short_link.errors[:audience]).to be_present
    end
  end
end
