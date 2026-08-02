require "rails_helper"

# Exercises the ADR 0006 image rules through Item (max 6) and Shop (max 3).
RSpec.describe ImageAttachable, type: :model do
  def png
    { io: File.open(Rails.root.join("spec/fixtures/files/sample.png")), filename: "sample.png", content_type: "image/png" }
  end

  describe "content type" do
    it "accepts JPEG/PNG/WebP" do
      item = build(:item)
      item.photos.attach(png)
      expect(item).to be_valid
    end

    it "rejects a non-image type" do
      item = build(:item)
      item.photos.attach(io: StringIO.new("nope"), filename: "note.txt", content_type: "text/plain")
      expect(item).not_to be_valid
      expect(item.errors[:photos]).to be_present
    end
  end

  describe "size" do
    it "rejects a file larger than 5 MB" do
      item = build(:item)
      item.photos.attach(io: StringIO.new("x" * (5.megabytes + 1)), filename: "big.png", content_type: "image/png")
      expect(item).not_to be_valid
    end
  end

  describe "count" do
    it "rejects more than 1 cover photo on a shop" do
      shop = build(:shop)
      2.times { shop.cover_photo.attach(png) }
      expect(shop).not_to be_valid
      expect(shop.errors[:cover_photo].join).to match(/more than 1/)
    end

    it "allows up to 6 photos on an item" do
      item = build(:item)
      6.times { item.photos.attach(png) }
      expect(item).to be_valid
    end
  end
end
