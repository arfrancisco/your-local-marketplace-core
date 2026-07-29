require "digest"

class ApiToken < ApplicationRecord
  belongs_to :user

  TTL = 30.days

  scope :active, -> { where("expires_at IS NULL OR expires_at > ?", Time.current) }

  # Mints a token for a user and returns [record, plaintext_token]. The
  # plaintext is shown to the client exactly once; only its SHA-256 digest is
  # stored. High-entropy random tokens don't need BCrypt — SHA-256 keeps
  # per-request auth lookups fast while still being useless if the DB leaks.
  def self.issue!(user)
    raw = SecureRandom.urlsafe_base64(32)
    record = create!(user: user, token_digest: digest(raw), expires_at: TTL.from_now)
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
