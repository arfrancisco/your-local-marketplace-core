require "digest"

# Line-for-line mirror of ApiToken, scoped to AdminUser instead of User. Kept
# as a fully separate model/table (not a polymorphic belongs_to) to keep the
# admin security boundary architecturally isolated from customer/vendor auth
# — see docs/adr/0010-per-admin-accounts.md.
class AdminApiToken < ApplicationRecord
  belongs_to :admin_user

  TTL = 30.days

  scope :active, -> { where("expires_at IS NULL OR expires_at > ?", Time.current) }

  # Mints a token for an admin and returns [record, plaintext_token]. The
  # plaintext is shown to the client exactly once; only its SHA-256 digest is
  # stored. `ttl:` lets the admin_users:mint_token rake task issue a
  # longer-lived token for admin-mcp without changing the default for the
  # normal HTTP login endpoint.
  def self.issue!(admin_user, ttl: TTL)
    raw = SecureRandom.urlsafe_base64(32)
    record = create!(admin_user: admin_user, token_digest: digest(raw), expires_at: ttl.from_now)
    [record, raw]
  end

  # Resolves a presented bearer token to its live record, or nil.
  def self.authenticate(raw)
    return nil if raw.blank?

    active.find_by(token_digest: digest(raw))
  end

  def self.digest(raw)
    Digest::SHA256.hexdigest(raw)
  end

  def touch_usage!
    update_column(:last_used_at, Time.current)
  end
end
