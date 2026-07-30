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
    owner: "Lola Remedios", email: "lolas.kitchen@example.com", slug: "lolas-kitchen",
    name: "Lola's Kitchen", description: "Home-cooked Filipino meals, fresh daily.",
    address: "Tower A, Unit 3B", fulfillment: %w[pickup delivery],
    items: [
      ["Chicken Adobo Bowl", "Classic pork-and-chicken adobo over garlic rice.", 18_000, ["Rice Meal", "Filipino", "Comfort Food"]],
      ["Kare-Kare", "Oxtail and vegetables in peanut sauce, with bagoong.", 22_000, ["Filipino", "Ulam"]],
      ["Pork Sinigang", "Sour tamarind soup with pork and vegetables.", 20_000, ["Filipino", "Soup"]]
    ]
  },
  {
    owner: "Manong Ben", email: "corner.bakeshop@example.com", slug: "corner-bakeshop",
    name: "Corner Bakeshop", description: "Fresh bread and pastries baked every morning.",
    address: "Tower B, Ground Floor", fulfillment: %w[pickup],
    items: [
      ["Pandesal (6 pcs)", "Warm, soft classic pandesal.", 4_000, ["Bread", "Breakfast"]],
      ["Ensaymada", "Buttery brioche topped with cheese and sugar.", 5_500, ["Bread", "Merienda"]],
      ["Ube Cheese Pandesal", "Ube-filled pandesal with a cheesy center.", 6_500, ["Bread", "Sweet"]]
    ]
  },
  {
    owner: "Ate Grace", email: "brew.and.co@example.com", slug: "brew-and-co",
    name: "Brew & Co.", description: "Small-batch coffee and cold drinks.",
    address: "Tower A, Unit 1F", fulfillment: %w[pickup delivery],
    items: [
      ["Iced Spanish Latte", "Espresso, milk, and a touch of condensed milk.", 13_000, ["Coffee", "Drinks"]],
      ["Kapeng Barako", "Strong local brew, served hot.", 9_000, ["Coffee"]],
      ["Matcha Latte", "Ceremonial-grade matcha with fresh milk.", 15_000, ["Drinks", "Matcha"]]
    ]
  },
  {
    owner: "Kuya Ram", email: "sizzle.house@example.com", slug: "sizzle-house",
    name: "Sizzle House", description: "Grilled favorites and hearty ulam.",
    address: "Tower C, Unit 2A", fulfillment: %w[pickup delivery],
    items: [
      ["Pork BBQ Skewers (3)", "Sweet-savory grilled pork skewers.", 12_000, ["Grill", "Savory"]],
      ["Chicken Inasal", "Bacolod-style grilled chicken with sinamak.", 17_000, ["Grill", "Filipino"]],
      ["Pork Sisig", "Sizzling chopped pork with calamansi and chili.", 19_000, ["Ulam", "Savory"]]
    ]
  },
  {
    owner: "Tita Baby", email: "sweet.tooth@example.com", slug: "sweet-tooth",
    name: "Sweet Tooth", description: "Homemade desserts and merienda treats.",
    address: "Tower B, Unit 5C", fulfillment: %w[pickup],
    items: [
      ["Leche Flan", "Silky caramel custard.", 9_000, ["Dessert", "Sweet"]],
      ["Halo-Halo", "Shaved ice with beans, fruit, leche flan, and ube.", 12_000, ["Dessert", "Merienda"]],
      ["Ube Cake Slice", "Moist ube chiffon with ube buttercream.", 11_000, ["Dessert", "Sweet"]]
    ]
  },
  {
    owner: "Coach Mia", email: "green.bowl@example.com", slug: "green-bowl",
    name: "Green Bowl", description: "Fresh salads and healthy rice bowls.",
    address: "Tower A, Unit 8D", fulfillment: %w[pickup delivery],
    items: [
      ["Chicken Caesar Bowl", "Grilled chicken, romaine, parmesan, house Caesar.", 21_000, ["Healthy", "Salad"]],
      ["Vegan Buddha Bowl", "Quinoa, chickpeas, roasted veg, tahini dressing.", 20_000, ["Healthy", "Vegan"]],
      ["Fresh Fruit Cup", "Seasonal fruit, cut fresh to order.", 8_000, ["Healthy", "Snack"]]
    ]
  },
  {
    owner: "Kuya Jun", email: "street.eats@example.com", slug: "street-eats",
    name: "Street Eats", description: "Filipino street food favorites, made fresh to order.",
    address: "Tower C, Ground Floor", fulfillment: %w[pickup],
    items: [
      ["Fishball (10 pcs)", "Deep-fried fishball with sweet and spicy sauce.", 5_000, ["Street Food", "Snack"]],
      ["Kwek-Kwek (8 pcs)", "Orange-battered quail eggs, deep-fried.", 6_000, ["Street Food", "Snack"]],
      ["Isaw (10 sticks)", "Grilled chicken intestines, smoky and savory.", 7_000, ["Street Food", "Grill"]]
    ]
  },
  {
    owner: "Ate Len", email: "milky.way.tea@example.com", slug: "milky-way-tea",
    name: "Milky Way Tea", description: "Milk tea and fruit tea, made fresh per order.",
    address: "Tower B, Unit 2C", fulfillment: %w[pickup delivery],
    items: [
      ["Classic Milk Tea", "Black tea, fresh milk, brown sugar pearls.", 11_000, ["Tea", "Milk Tea", "Drinks"]],
      ["Wintermelon Milk Tea", "Wintermelon-infused tea with milk.", 11_000, ["Tea", "Milk Tea", "Drinks"]],
      ["Strawberry Fruit Tea", "Real strawberry chunks in green tea.", 10_500, ["Tea", "Fruit Tea", "Drinks"]]
    ]
  },
  {
    owner: "Manong Dado", email: "slice.corner@example.com", slug: "slice-corner",
    name: "Slice Corner", description: "Pizza by the slice, baked fresh throughout the day.",
    address: "Tower A, Unit 6A", fulfillment: %w[pickup delivery],
    items: [
      ["Pepperoni Slice", "Classic pepperoni with mozzarella.", 9_500, ["Pizza", "Savory"]],
      ["Four Cheese Slice", "Mozzarella, cheddar, parmesan, and feta.", 10_000, ["Pizza", "Savory"]],
      ["Hawaiian Slice", "Ham and pineapple, a household favorite.", 9_500, ["Pizza", "Savory"]]
    ]
  },
  {
    owner: "Aling Nena", email: "sunny.side.diner@example.com", slug: "sunny-side-diner",
    name: "Sunny Side Diner", description: "All-day Filipino breakfast, silog meals a specialty.",
    address: "Tower C, Unit 4B", fulfillment: %w[pickup delivery],
    items: [
      ["Tapsilog", "Beef tapa, garlic rice, and a fried egg.", 14_000, ["Breakfast", "Silog", "Filipino"]],
      ["Longsilog", "Sweet longganisa, garlic rice, and a fried egg.", 12_500, ["Breakfast", "Silog", "Filipino"]],
      ["Bangsilog", "Fried milkfish, garlic rice, and a fried egg.", 15_000, ["Breakfast", "Silog", "Filipino"]]
    ]
  },
  {
    owner: "Kuya Wesley", email: "wok.this.way@example.com", slug: "wok-this-way",
    name: "Wok This Way", description: "Chinese-Filipino comfort food: siomai, noodles, dimsum.",
    address: "Tower B, Unit 7A", fulfillment: %w[pickup delivery],
    items: [
      ["Siomai (8 pcs)", "Steamed pork and shrimp siomai with soy-calamansi.", 9_000, ["Dimsum", "Chinese"]],
      ["Beef Mami", "Beef noodle soup with scallions.", 13_000, ["Noodles", "Soup", "Chinese"]],
      ["Siopao Asado", "Steamed bun filled with sweet pork asado.", 5_500, ["Dimsum", "Chinese"]]
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

  shop = profile.shops.find_or_create_by!(slug: data[:slug]) do |s|
    s.name = data[:name]
    s.description = data[:description]
    s.address = data[:address]
    s.contact_number = owner.mobile_number
    s.fulfillment_methods = data[:fulfillment]
  end
  shop.open! unless shop.open?

  data[:items].each_with_index do |(name, description, price_cents, tags), position|
    item = shop.items.find_by(name: name)
    if item.nil?
      item = shop.items.create!(
        name: name, description: description, price_cents: price_cents,
        currency: "PHP", position: position
      )
      item.tags = Tag.for_names(tags)
    end
    # Backfills photos on items seeded before this existed, not just new ones.
    attach_placeholder_photos(item) if item.photos.blank?
  end
end

puts "Seeded #{Shop.count} shops and #{Item.count} items across #{Tag.count} tags."
puts "Test accounts (password123): customer@example.com, both@example.com, and 6 demo vendors."
