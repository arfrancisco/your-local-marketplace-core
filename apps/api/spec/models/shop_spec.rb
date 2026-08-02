require "rails_helper"

RSpec.describe Shop, type: :model do
  subject { build(:shop) }

  it { is_expected.to validate_presence_of(:name) }
  it { is_expected.to belong_to(:vendor_profile) }

  describe "one shop per vendor" do
    it "rejects a second shop for a vendor who already has one" do
      profile = create(:shop).vendor_profile
      second = build(:shop, vendor_profile: profile)

      expect(second).not_to be_valid
      expect(second.errors[:vendor_profile_id]).to be_present
    end
  end

  describe "slug generation" do
    it "derives a slug from the name at creation" do
      shop = create(:shop, name: "Corner Kitchen")
      expect(shop.slug).to eq("corner-kitchen")
    end

    it "disambiguates a colliding slug with a numeric suffix" do
      create(:shop, name: "Corner Kitchen")
      second = create(:shop, name: "Corner Kitchen")
      expect(second.slug).to eq("corner-kitchen-2")
    end

    it "does not change the slug when the name later changes" do
      shop = create(:shop, name: "Corner Kitchen")
      shop.update!(name: "Renamed Kitchen")
      expect(shop.slug).to eq("corner-kitchen")
    end
  end

  describe "fulfillment methods" do
    it "requires at least one method" do
      shop = build(:shop, fulfillment_methods: [])
      expect(shop).not_to be_valid
      expect(shop.errors[:fulfillment_methods]).to be_present
    end

    it "rejects an unsupported method" do
      expect(build(:shop, fulfillment_methods: %w[teleport])).not_to be_valid
    end

    it "accepts pickup and delivery together" do
      expect(build(:shop, fulfillment_methods: %w[pickup delivery])).to be_valid
    end
  end

  describe "open/close" do
    it "opening activates the shop and accepts orders" do
      shop = create(:shop)
      shop.open!
      expect(shop).to be_open
      expect(shop.status).to eq("active")
    end

    it "closing stops accepting orders" do
      shop = create(:shop, :open)
      shop.close!
      expect(shop).not_to be_open
      expect(shop.accepting_orders).to be(false)
    end

    it "lists only active, accepting shops" do
      open_shop = create(:shop, :open)
      create(:shop) # draft
      expect(Shop.listed).to contain_exactly(open_shop)
    end
  end
end
