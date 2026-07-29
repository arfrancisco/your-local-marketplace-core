# Rate limiting for abuse-prone endpoints (auth, verification, and later image
# uploads). Uses the Rails cache store as its backend. Throttling is disabled in
# the test environment so specs are deterministic; toggle with RACK_ATTACK_ENABLED.
class Rack::Attack
  Rack::Attack.enabled = ENV.fetch("RACK_ATTACK_ENABLED", !Rails.env.test?.to_s) != "false"

  # A blocked request gets a JSON 429, matching the API error envelope.
  self.throttled_responder = lambda do |request|
    retry_after = (request.env["rack.attack.match_data"] || {})[:period]
    [
      429,
      { "Content-Type" => "application/json", "Retry-After" => retry_after.to_s },
      [{ error: { code: "rate_limited", message: "Too many requests. Try again later." } }.to_json]
    ]
  end

  # Login/register: 10 attempts per minute per IP.
  throttle("auth/ip", limit: 10, period: 60) do |req|
    req.ip if req.path.start_with?("/api/v1/auth") && req.post?
  end

  # Verification send/confirm: 5 per minute per IP (codes cost money to send).
  throttle("verifications/ip", limit: 5, period: 60) do |req|
    req.ip if req.path.include?("/verifications") && req.post?
  end
end
