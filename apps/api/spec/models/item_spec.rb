require "rails_helper"

RSpec.describe Item, type: :model do
  subject { build(:item) }

  it { is_expected.to belong_to(:shop) }
  it { is_expected.to validate_presence_of(:name) }

  it "requires a positive integer price" do
    expect(build(:item, price_cents: 0)).not_to be_valid
    expect(build(:item, price_cents: -5)).not_to be_valid
    expect(build(:item, price_cents: 1500)).to be_valid
  end

  describe "enable/disable" do
    it "disabling keeps the record but marks it unorderable" do
      item = create(:item)
      item.disable!
      expect(item.enabled).to be(false)
      expect(Item.enabled).not_to include(item)
    end
  end

  describe "tags" do
    it "attaches resolved tags without duplicating existing ones" do
      create(:tag, name: "Vegan")
      item = create(:item)
      item.tags = Tag.for_names(["Vegan", "spicy", "spicy"])
      expect(item.tags.map(&:slug)).to contain_exactly("vegan", "spicy")
      expect(Tag.count).to eq(2)
    end
  end
end
