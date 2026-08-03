require "rails_helper"

RSpec.describe SocialPreviews::BuildShopMeta do
  def png
    { io: File.open(Rails.root.join("spec/fixtures/files/sample.png")), filename: "sample.png", content_type: "image/png" }
  end

  let(:base_url) { "https://prisma.kapitmarket.ph" }

  it "uses the shop's own name, description, and slug" do
    shop = create(:shop, :open, name: "Ube or Not Ube", slug: "ube-or-not-ube",
                                 description: "Homemade desserts and merienda treats.")

    meta = described_class.new(shop: shop, base_url: base_url).call

    expect(meta[:title]).to eq("Ube or Not Ube — Prisma KapitMarket")
    expect(meta[:description]).to eq("Homemade desserts and merienda treats.")
    expect(meta[:canonical_url]).to eq("https://prisma.kapitmarket.ph/shops/ube-or-not-ube")
  end

  it "falls back to a site-wide description when the shop has none" do
    shop = create(:shop, :open, description: nil)

    meta = described_class.new(shop: shop, base_url: base_url).call

    expect(meta[:description]).to eq(
      "Order food and goods from your neighbors — pickup or delivery, all within your own building cluster."
    )
  end

  it "uses the shop's cover photo when attached" do
    shop = create(:shop, :open)
    shop.cover_photo.attach(png)

    meta = described_class.new(shop: shop, base_url: base_url).call

    expect(meta[:image_url]).to start_with("https://prisma.kapitmarket.ph/rails/active_storage/")
  end

  it "falls back to the profile photo when there is no cover photo" do
    shop = create(:shop, :open)
    shop.profile_photo.attach(png)

    meta = described_class.new(shop: shop, base_url: base_url).call

    expect(meta[:image_url]).to start_with("https://prisma.kapitmarket.ph/rails/active_storage/")
  end

  it "falls back to the site-wide default image when the shop has neither photo" do
    shop = create(:shop, :open)

    meta = described_class.new(shop: shop, base_url: base_url).call

    expect(meta[:image_url]).to eq("https://prisma.kapitmarket.ph/bazaar.jpg")
  end
end
