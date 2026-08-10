# Rate limiting for abuse-prone endpoints (auth, verification, and later image
# uploads). Uses the Rails cache store as its backend. Throttling is disabled in
# the test environment so specs are deterministic; toggle with RACK_ATTACK_ENABLED.
class Rack::Attack
  # Not a real raised exception -- constructed and handed to ErrorLog.record!
  # purely to get the same fingerprint/dedup/first-occurrence-alert behavior
  # real exceptions get. A stable class + message keeps every hit (regardless
  # of which IP triggered it) collapsing onto one fingerprint, so an attacker
  # rotating IPs to dodge the throttle itself doesn't also multiply alert
  # emails -- occurrences_count climbs instead, visible in the admin panel.
  class RegisterThrottleExceeded < StandardError; end

  Rack::Attack.enabled = ENV.fetch("RACK_ATTACK_ENABLED", !Rails.env.test?.to_s) != "false"

  # A blocked request gets a JSON 429, matching the API error envelope. Only
  # the registration throttle (not login/verifications/etc, which real users
  # trip far more often via ordinary retries) is worth an operator alert --
  # ErrorAlertJob only fires on this fingerprint's first-ever occurrence, so
  # this does not turn into an email per throttled request.
  self.throttled_responder = lambda do |request|
    retry_after = (request.env["rack.attack.match_data"] || {})[:period]

    if request.env["rack.attack.matched"] == "auth/register/ip"
      exception = RegisterThrottleExceeded.new("Registration rate limit exceeded for an IP")
      exception.set_backtrace(caller)
      log, newly_created = ErrorLog.record!(source: "backend", exception: exception, request: request)
      ErrorAlertJob.perform_later(log.id) if newly_created
    end

    [
      429,
      { "Content-Type" => "application/json", "Retry-After" => retry_after.to_s },
      [{ error: { code: "rate_limited", message: "Too many requests. Try again later." } }.to_json]
    ]
  end

  # Login/logout: 10 attempts per minute per IP -- cheap to attempt (just a
  # DB lookup + bcrypt check), so this is sized for brute-force protection.
  throttle("auth/login/ip", limit: 10, period: 60) do |req|
    req.ip if req.post? && (req.path == "/api/v1/auth/login" || req.path == "/api/v1/auth/logout")
  end

  # Registration: 5 per minute per IP, tighter than login and in its own
  # bucket -- unlike login, a successful call here triggers a real Semaphore
  # SMS send (2 credits/OTP), so the limit is sized for cost exposure, not
  # brute-force. This alone doesn't stop an attacker minting many distinct
  # accounts with real-format-but-fake numbers (User#mobile_number is unique,
  # so Verifications::IssueChallenge's own per-destination cap never sees
  # more than one hit per number in that pattern) -- this throttle is what
  # actually caps that, by capping the source instead of the destination.
  throttle("auth/register/ip", limit: 5, period: 60) do |req|
    req.ip if req.post? && req.path == "/api/v1/auth/register"
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
