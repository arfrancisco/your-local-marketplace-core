class VerificationChallenge < ApplicationRecord
  belongs_to :user

  CHANNELS = %w[email sms].freeze
  PURPOSES = %w[email_verification mobile_verification].freeze

  CODE_TTL = 10.minutes
  MAX_ATTEMPTS = 5

  validates :channel, inclusion: { in: CHANNELS }
  validates :purpose, inclusion: { in: PURPOSES }
  validates :code_digest, :sent_to, :expires_at, presence: true

  scope :live, -> { where(consumed_at: nil).where("expires_at > ?", Time.current) }

  # Issues a fresh challenge and returns [challenge, plaintext_code]. The
  # plaintext is returned only here (to hand to the delivery job) and is never
  # persisted — only its BCrypt digest is stored.
  def self.issue!(user:, channel:, purpose:, sent_to:)
    code = format("%06d", SecureRandom.random_number(1_000_000))
    challenge = create!(
      user: user,
      channel: channel,
      purpose: purpose,
      sent_to: sent_to,
      code_digest: BCrypt::Password.create(code),
      expires_at: CODE_TTL.from_now
    )
    [challenge, code]
  end

  def expired?
    expires_at <= Time.current
  end

  def consumed?
    consumed_at.present?
  end

  # Returns true and consumes the challenge on a correct code; false otherwise.
  # Every call counts as an attempt so guessing is bounded by MAX_ATTEMPTS.
  def verify(code)
    return false if consumed? || expired? || attempts_count >= MAX_ATTEMPTS

    increment!(:attempts_count)
    return false unless BCrypt::Password.new(code_digest) == code.to_s

    update!(consumed_at: Time.current)
    true
  end
end
