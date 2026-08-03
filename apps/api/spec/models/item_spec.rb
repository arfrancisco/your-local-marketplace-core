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

  describe "stock_count / sold_out?" do
    it "treats a nil stock_count as not tracked (never sold out)" do
      item = build(:item, stock_count: nil)
      expect(item).to be_valid
      expect(item).not_to be_sold_out
    end

    it "is sold out once stock_count reaches zero, but stays enabled" do
      item = create(:item, stock_count: 0)
      expect(item).to be_sold_out
      expect(item.enabled).to be(true)
    end

    it "is not sold out while stock remains" do
      expect(build(:item, stock_count: 3)).not_to be_sold_out
    end

    it "rejects a negative stock_count" do
      expect(build(:item, stock_count: -1)).not_to be_valid
    end
  end

  describe "archiving" do
    it "archives and unarchives, independent of enabled" do
      item = create(:item)
      item.archive!
      expect(item.archived?).to be(true)
      expect(item.enabled).to be(true) # archiving never touches enabled

      item.unarchive!
      expect(item.archived?).to be(false)
    end

    it "excludes archived items from the enabled scope, even if still enabled" do
      item = create(:item, enabled: true)
      item.archive!
      expect(Item.enabled).not_to include(item)
    end

    it "the active scope excludes archived items but includes disabled ones" do
      active = create(:item)
      archived = create(:item, archived_at: Time.current)
      disabled = create(:item, enabled: false)

      expect(Item.active).to include(active, disabled)
      expect(Item.active).not_to include(archived)
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
