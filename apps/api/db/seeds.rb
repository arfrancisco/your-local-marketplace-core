# Idempotent seed data. Safe to run repeatedly: every record is looked up before
# it is created. Covers M0 test accounts plus a set of believable open demo shops
# so the customer discovery / early-access demo looks alive.
#
# Run with: bin/rails db:seed

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
    next if shop.items.exists?(name: name)

    item = shop.items.create!(
      name: name, description: description, price_cents: price_cents,
      currency: "PHP", position: position
    )
    item.tags = Tag.for_names(tags)
  end
end

puts "Seeded #{Shop.count} shops and #{Item.count} items across #{Tag.count} tags."
puts "Test accounts (password123): customer@example.com, both@example.com, and 6 demo vendors."
