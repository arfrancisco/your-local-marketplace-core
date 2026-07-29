# Idempotent seed data for local development. Safe to run repeatedly: every
# record is looked up before it is created. Only M0 identity data exists this
# phase (shops/items/orders arrive in later milestones).
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

customer = find_or_create_user!(
  email: "customer@example.com", password: "password123", mobile_number: "+639170000001"
)
customer.create_customer_profile!(display_name: "Sample Customer") unless customer.customer_profile

vendor = find_or_create_user!(
  email: "vendor@example.com", password: "password123", mobile_number: "+639170000002"
)
vendor.create_vendor_profile!(display_name: "Sample Vendor") unless vendor.vendor_profile

# A user who holds both capabilities, to exercise the capability-based model.
both = find_or_create_user!(
  email: "both@example.com", password: "password123", mobile_number: "+639170000003"
)
both.create_customer_profile!(display_name: "Both (customer)") unless both.customer_profile
both.create_vendor_profile!(display_name: "Both (vendor)") unless both.vendor_profile

# A sample open shop with one item, owned by the vendor, so the vendor-web
# client has something to display on first run.
shop = vendor.vendor_profile.shops.find_or_create_by!(slug: "sample-corner-kitchen") do |s|
  s.name = "Sample Corner Kitchen"
  s.description = "Home-cooked meals from unit 12F."
  s.address = "Tower A, Unit 12F"
  s.contact_number = "+639170000002"
  s.fulfillment_methods = %w[pickup delivery]
end
shop.open! unless shop.open?

unless shop.items.exists?(name: "Adobo Rice Bowl")
  item = shop.items.create!(name: "Adobo Rice Bowl", description: "Pork adobo over garlic rice.",
                            price_cents: 18_000, currency: "PHP")
  item.tags = Tag.for_names(["Rice Meal", "Savory"])
end

puts "Seeded #{Shop.count} shop(s) and #{Item.count} item(s)."
puts "Seeded #{User.count} users:"
puts "  customer@example.com / password123 (customer)"
puts "  vendor@example.com   / password123 (vendor)"
puts "  both@example.com     / password123 (customer + vendor)"
