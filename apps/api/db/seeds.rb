# Idempotent seed data. Safe to run repeatedly: every record is looked up before
# it is created. Covers M0 test accounts plus a set of believable open demo shops
# so the customer discovery / early-access demo looks alive.
#
# Run with: bin/rails db:seed

require "zlib"

# Generates a solid-color PNG with no external dependency (ImageMagick/libvips
# are not installed on this box). Good enough as a placeholder photo — a real
# vendor photo replaces it the moment one is uploaded via vendor-web.
def solid_color_png(width, height, rgb)
  chunk = lambda do |type, data|
    [data.bytesize].pack("N") + type + data + [Zlib.crc32(type + data)].pack("N")
  end

  signature = [137, 80, 78, 71, 13, 10, 26, 10].pack("C8")
  ihdr = chunk.call("IHDR", [width, height, 8, 2, 0, 0, 0].pack("NNC5"))
  row = ([0] + rgb * width).pack("C*") # filter byte 0 (None) + RGB pixels
  idat = chunk.call("IDAT", Zlib::Deflate.deflate(row * height))
  iend = chunk.call("IEND", "")
  signature + ihdr + idat + iend
end

# Deterministic hue from a string, offset per photo index so a multi-photo
# item shows visibly different (but related) colors in its gallery. Kept in a
# warm band (reds through amber/gold) to match the customer-web tile palette —
# a food marketplace shouldn't roll a cool blue or green placeholder.
def hue_for(seed, offset)
  (seed.sum + offset * 15) % 48
end

def hsl_to_rgb(h, s, l)
  c = (1 - (2 * l - 1).abs) * s
  x = c * (1 - ((h / 60.0) % 2 - 1).abs)
  m = l - c / 2
  r, g, b = case h
            when 0...60 then [c, x, 0]
            when 60...120 then [x, c, 0]
            when 120...180 then [0, c, x]
            when 180...240 then [0, x, c]
            when 240...300 then [x, 0, c]
            else [c, 0, x]
            end
  [r, g, b].map { |v| ((v + m) * 255).round }
end

def attach_placeholder_photos(item, count: 3)
  count.times do |i|
    rgb = hsl_to_rgb(hue_for(item.name, i), 0.55, 0.72)
    png = solid_color_png(480, 360, rgb)
    item.photos.attach(
      io: StringIO.new(png), filename: "#{item.name.parameterize}-#{i + 1}.png", content_type: "image/png"
    )
  end
end

# Attaches a real curated stock photo (see db/seed_photos/SOURCES.md) instead of
# a generated placeholder — makes the demo look like an actual marketplace
# rather than a scaffold. Falls back to a generated tile if a filename isn't
# given, so adding a shop/item without sourcing a photo never breaks seeding.
SEED_PHOTOS_DIR = Rails.root.join("db/seed_photos")

def attach_seed_photo(record, filename, attachment: :photos)
  path = SEED_PHOTOS_DIR.join(filename)
  content_type = filename.end_with?(".png") ? "image/png" : "image/jpeg"
  record.public_send(attachment).attach(io: File.open(path), filename: filename, content_type: content_type)
end

def find_or_create_user!(email:, password:, mobile_number:, verified: true)
  user = User.find_by("lower(email) = ?", email.downcase)
  return user if user

  User.create!(
    email: email,
    password: password,
    mobile_number: mobile_number,
    email_verified_at: verified ? Time.current : nil,
    mobile_verified_at: verified ? Time.current : nil
  )
end

# --- Base test accounts (auth / capability model) -----------------------------

customer = find_or_create_user!(
  email: "customer@example.com", password: "password123", mobile_number: "+639170000001"
)
customer.create_customer_profile!(display_name: "Sample Customer") unless customer.customer_profile

both = find_or_create_user!(
  email: "both@example.com", password: "password123", mobile_number: "+639170000003"
)
both.create_customer_profile!(display_name: "Both (customer)") unless both.customer_profile
both.create_vendor_profile!(display_name: "Both (vendor)") unless both.vendor_profile

# --- Demo shops ---------------------------------------------------------------
# Each shop is owned by its own verified vendor and opened so it shows up in
# discovery. Prices are in centavos (PHP). Photos are intentionally omitted —
# the clients render clean monogram/emoji tiles until real photos are uploaded.

DEMO_SHOPS = [
  {
    owner: "Lola Remedios", email: "lolas.kitchen@example.com", slug: "kare-kare-oke",
    name: "Kare-Kare-oke", description: "Home-cooked Filipino meals, fresh daily.",
    address: "Tower A, Unit 3B", fulfillment: %w[pickup delivery], cover_photo: "adobo-candidate.jpg",
    items: [
      ["Chicken Adobo Bowl", "Classic pork-and-chicken adobo over garlic rice.", 18_000, ["Rice Meal", "Filipino", "Comfort Food"], "adobo-candidate.jpg"],
      ["Kare-Kare", "Oxtail and vegetables in peanut sauce, with bagoong.", 22_000, ["Filipino", "Ulam"], "oxtail-stew.jpg"],
      ["Pork Sinigang", "Sour tamarind soup with pork and vegetables.", 20_000, ["Filipino", "Soup"], "beef-noodle.jpg"]
    ]
  },
  {
    owner: "Manong Ben", email: "corner.bakeshop@example.com", slug: "bread-pitt",
    name: "Bread Pitt", description: "Fresh bread and pastries baked every morning.",
    address: "Tower B, Ground Floor", fulfillment: %w[pickup], cover_photo: "bread-rolls.jpg",
    items: [
      ["Pandesal (6 pcs)", "Warm, soft classic pandesal.", 4_000, ["Bread", "Breakfast"], "bread-rolls.jpg"],
      ["Ensaymada", "Buttery brioche topped with cheese and sugar.", 5_500, ["Bread", "Merienda"], "sweet-cheese-roll.jpg"],
      ["Ube Cheese Pandesal", "Ube-filled pandesal with a cheesy center.", 6_500, ["Bread", "Sweet"], "ube-pandesal.jpg"]
    ]
  },
  {
    owner: "Ate Grace", email: "brew.and.co@example.com", slug: "brewhaha",
    name: "Brewhaha", description: "Small-batch coffee and cold drinks.",
    address: "Tower A, Unit 1F", fulfillment: %w[pickup delivery], cover_photo: "iced-latte.jpg",
    items: [
      ["Iced Spanish Latte", "Espresso, milk, and a touch of condensed milk.", 13_000, ["Coffee", "Drinks"], "iced-latte.jpg"],
      ["Kapeng Barako", "Strong local brew, served hot.", 9_000, ["Coffee"], "kapeng-barako.jpg"],
      ["Matcha Latte", "Ceremonial-grade matcha with fresh milk.", 15_000, ["Drinks", "Matcha"], "matcha-latte.jpg"]
    ]
  },
  {
    owner: "Kuya Ram", email: "sizzle.house@example.com", slug: "lord-of-the-grills",
    name: "Lord of the Grills", description: "Grilled favorites and hearty ulam.",
    address: "Tower C, Unit 2A", fulfillment: %w[pickup delivery], cover_photo: "grill-skewers.jpg",
    items: [
      ["Pork BBQ Skewers (3)", "Sweet-savory grilled pork skewers.", 12_000, ["Grill", "Savory"], "grill-skewers.jpg"],
      ["Chicken Inasal", "Bacolod-style grilled chicken with sinamak.", 17_000, ["Grill", "Filipino"], "chicken-skewer.jpg"],
      ["Pork Sisig", "Sizzling chopped pork with calamansi and chili.", 19_000, ["Ulam", "Savory"], "sisig-candidate.jpg"]
    ]
  },
  {
    owner: "Tita Baby", email: "sweet.tooth@example.com", slug: "ube-or-not-ube",
    name: "Ube or Not Ube", description: "Homemade desserts and merienda treats.",
    address: "Tower B, Unit 5C", fulfillment: %w[pickup], cover_photo: "ube-cake.png",
    items: [
      ["Leche Flan", "Silky caramel custard.", 9_000, ["Dessert", "Sweet"], "leche-flan.jpg"],
      ["Halo-Halo", "Shaved ice with beans, fruit, leche flan, and ube.", 12_000, ["Dessert", "Merienda"], "halo-halo.jpg"],
      ["Ube Cake Slice", "Moist ube chiffon with ube buttercream.", 11_000, ["Dessert", "Sweet"], "ube-cake.png"]
    ]
  },
  {
    owner: "Coach Mia", email: "green.bowl@example.com", slug: "lettuce-eat-healthy",
    name: "Lettuce Eat Healthy", description: "Fresh salads and healthy rice bowls.",
    address: "Tower A, Unit 8D", fulfillment: %w[pickup delivery], cover_photo: "buddha-bowl.jpg",
    items: [
      ["Chicken Caesar Bowl", "Grilled chicken, romaine, parmesan, house Caesar.", 21_000, ["Healthy", "Salad"], "caesar-bowl.jpg"],
      ["Vegan Buddha Bowl", "Quinoa, chickpeas, roasted veg, tahini dressing.", 20_000, ["Healthy", "Vegan"], "buddha-bowl.jpg"],
      ["Fresh Fruit Cup", "Seasonal fruit, cut fresh to order.", 8_000, ["Healthy", "Snack"], "fruit-cup.jpg"]
    ]
  },
  {
    owner: "Kuya Jun", email: "street.eats@example.com", slug: "i-saw-my-chance",
    name: "I Saw My Chance", description: "Filipino street food favorites, made fresh to order.",
    address: "Tower C, Ground Floor", fulfillment: %w[pickup], cover_photo: "isaw-manila-skewers.jpg",
    items: [
      ["Fishball (10 pcs)", "Deep-fried fishball with sweet and spicy sauce.", 5_000, ["Street Food", "Snack"], "street-food-cart.jpg"],
      ["Kwek-Kwek (8 pcs)", "Orange-battered quail eggs, deep-fried.", 6_000, ["Street Food", "Snack"], "street-food-cart.jpg"],
      ["Isaw (10 sticks)", "Grilled chicken intestines, smoky and savory.", 7_000, ["Street Food", "Grill"], "isaw-manila-skewers.jpg"]
    ]
  },
  {
    owner: "Ate Len", email: "milky.way.tea@example.com", slug: "milky-way-tea",
    name: "Milky Way Tea", description: "Milk tea and fruit tea, made fresh per order.",
    address: "Tower B, Unit 2C", fulfillment: %w[pickup delivery], cover_photo: "milk-tea.jpg",
    items: [
      ["Classic Milk Tea", "Black tea, fresh milk, brown sugar pearls.", 11_000, ["Tea", "Milk Tea", "Drinks"], "milk-tea.jpg"],
      ["Wintermelon Milk Tea", "Wintermelon-infused tea with milk.", 11_000, ["Tea", "Milk Tea", "Drinks"], "milk-tea.jpg"],
      ["Strawberry Fruit Tea", "Real strawberry chunks in green tea.", 10_500, ["Tea", "Fruit Tea", "Drinks"], "strawberry-tea.jpg"]
    ]
  },
  {
    owner: "Manong Dado", email: "slice.corner@example.com", slug: "pizza-my-heart",
    name: "Pizza My Heart", description: "Pizza by the slice, baked fresh throughout the day.",
    address: "Tower A, Unit 6A", fulfillment: %w[pickup delivery], cover_photo: "pizza-pepperoni.jpg",
    items: [
      ["Pepperoni Slice", "Classic pepperoni with mozzarella.", 9_500, ["Pizza", "Savory"], "pizza-pepperoni.jpg"],
      ["Four Cheese Slice", "Mozzarella, cheddar, parmesan, and feta.", 10_000, ["Pizza", "Savory"], "four-cheese-pizza.jpg"],
      ["Hawaiian Slice", "Ham and pineapple, a household favorite.", 9_500, ["Pizza", "Savory"], "hawaiian-pizza.jpg"]
    ]
  },
  {
    owner: "Aling Nena", email: "sunny.side.diner@example.com", slug: "sunny-side-diner",
    name: "Sunny Side Diner", description: "All-day Filipino breakfast, silog meals a specialty.",
    address: "Tower C, Unit 4B", fulfillment: %w[pickup delivery], cover_photo: "tapsilog.jpg",
    items: [
      ["Tapsilog", "Beef tapa, garlic rice, and a fried egg.", 14_000, ["Breakfast", "Silog", "Filipino"], "tapsilog.jpg"],
      ["Longsilog", "Sweet longganisa, garlic rice, and a fried egg.", 12_500, ["Breakfast", "Silog", "Filipino"], "longsilog.jpg"],
      ["Bangsilog", "Fried milkfish, garlic rice, and a fried egg.", 15_000, ["Breakfast", "Silog", "Filipino"], "bangsilog.jpg"]
    ]
  },
  {
    owner: "Kuya Wesley", email: "wok.this.way@example.com", slug: "wok-this-way",
    name: "Wok This Way", description: "Chinese-Filipino comfort food: siomai, noodles, dimsum.",
    address: "Tower B, Unit 7A", fulfillment: %w[pickup delivery], cover_photo: "siomai.jpg",
    items: [
      ["Siomai (8 pcs)", "Steamed pork and shrimp siomai with soy-calamansi.", 9_000, ["Dimsum", "Chinese"], "siomai.jpg"],
      ["Beef Mami", "Beef noodle soup with scallions.", 13_000, ["Noodles", "Soup", "Chinese"], "beef-noodle.jpg"],
      ["Siopao Asado", "Steamed bun filled with sweet pork asado.", 5_500, ["Dimsum", "Chinese"], "siopao-candidate.jpg"]
    ]
  }
].freeze

DEMO_SHOPS.each_with_index do |data, i|
  owner = find_or_create_user!(
    email: data[:email], password: "password123",
    mobile_number: format("+63917100%04d", i + 1)
  )
  profile = owner.vendor_profile || owner.create_vendor_profile!(
    display_name: data[:owner], verification_status: "verified"
  )

  # Each vendor owns exactly one demo shop, so look it up by ownership (stable)
  # rather than slug — the slug changes when a shop is renamed (e.g. the pun
  # names), and find_or_create_by! only assigns attributes to brand-new
  # records, which would silently skip renaming an already-seeded shop.
  shop = profile.shops.first_or_initialize
  shop.name = data[:name]
  shop.slug = data[:slug]
  shop.description = data[:description]
  # `address` is the private exact-unit detail (vendor/order-context only);
  # `building` is the public-safe label shown to browsing customers — both
  # split here from the single "Tower X, <unit detail>" string every demo
  # address already follows.
  building_part, unit_part = data[:address].to_s.split(",", 2).map(&:strip)
  shop.building = building_part
  shop.address = unit_part.presence || building_part
  shop.contact_number = owner.mobile_number
  shop.fulfillment_methods = data[:fulfillment]
  shop.save!
  shop.open! unless shop.open?

  unless shop.cover_photo.attached?
    if data[:cover_photo]
      # No separate square logo-style assets sourced yet — the same photo
      # stands in for both fields for now, real demo photos either way.
      attach_seed_photo(shop, data[:cover_photo], attachment: :cover_photo)
      attach_seed_photo(shop, data[:cover_photo], attachment: :profile_photo)
    else
      rgb = hsl_to_rgb(hue_for(shop.name, 0), 0.55, 0.72)
      shop.cover_photo.attach(io: StringIO.new(solid_color_png(480, 360, rgb)), filename: "#{shop.slug}-cover.png", content_type: "image/png")
      shop.profile_photo.attach(io: StringIO.new(solid_color_png(200, 200, rgb)), filename: "#{shop.slug}-profile.png", content_type: "image/png")
    end
  end

  data[:items].each_with_index do |(name, description, price_cents, tags, photo), position|
    item = shop.items.find_by(name: name)
    if item.nil?
      item = shop.items.create!(
        name: name, description: description, price_cents: price_cents,
        currency: "PHP", position: position
      )
      item.tags = Tag.for_names(tags)
    end
    # Backfills photos on items seeded before this existed, not just new ones.
    next if item.photos.attached?

    photo ? attach_seed_photo(item, photo) : attach_placeholder_photos(item)
  end
end

puts "Seeded #{Shop.count} shops and #{Item.count} items across #{Tag.count} tags."
puts "Test accounts (password123): customer@example.com, both@example.com, and 6 demo vendors."
