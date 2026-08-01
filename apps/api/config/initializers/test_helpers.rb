# Test-helper endpoints/cache-writes exist only so the checked-in e2e suite
# (Playwright, real browsers against real running servers) can retrieve a
# real verification code without a real phone or inbox. Must never be
# reachable in production, even if ENABLE_TEST_HELPERS is set there by
# mistake — see the boot-time check below and the route guard in routes.rb.
module TestHelperAccess
  def self.enabled?
    Rails.env.test? || (Rails.env.development? && ENV["ENABLE_TEST_HELPERS"] == "true")
  end
end

if ENV["ENABLE_TEST_HELPERS"] == "true" && Rails.env.production?
  raise "ENABLE_TEST_HELPERS must never be set in production"
end
