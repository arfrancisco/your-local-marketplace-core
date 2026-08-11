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

  # Password reset request/confirm: 5 per minute per IP (same abuse shape as
  # verification codes — spamming an inbox, or brute-forcing a guessed code).
  throttle("password_resets/ip", limit: 5, period: 60) do |req|
    req.ip if req.path.include?("/password_resets") && req.post?
  end

  # Public discovery is scrapeable; cap it generously per IP.
  throttle("discovery/ip", limit: 120, period: 60) do |req|
    req.ip if req.get? && req.path.start_with?("/api/v1/shops")
  end

  # Short-link redirects (order-lifecycle SMS): public, unauthenticated, and
  # backed by a short random code, so this is generous for the same reason
  # discovery/ip is above — not because a redirect is expensive, but to
  # blunt casual code-enumeration scraping.
  throttle("short_links/ip", limit: 120, period: 60) do |req|
    req.ip if req.get? && req.path.start_with?("/s/")
  end

  # Client crash reports (see Api::V1::ClientErrorsController): public and
  # unauthenticated by design, since a browser can crash before the user
  # signs in. Fingerprint dedup only collapses *identical* reports, so a
  # caller who varies the payload per request can bypass it entirely — this
  # throttle, not the dedup, is what actually caps DB growth and the
  # per-new-fingerprint ErrorAlertJob email it triggers.
  throttle("client_errors/ip", limit: 20, period: 60) do |req|
    req.ip if req.path == "/api/v1/client_errors" && req.post?
  end
end
