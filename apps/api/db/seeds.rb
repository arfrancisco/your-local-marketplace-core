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

puts "Seeded #{User.count} users:"
puts "  customer@example.com / password123 (customer)"
puts "  vendor@example.com   / password123 (vendor)"
puts "  both@example.com     / password123 (customer + vendor)"
