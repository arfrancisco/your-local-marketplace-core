module Auth
  # Issues a password-reset code, always via email (the account's real login
  # identifier — mobile might not even be verified at this point). Always
  # returns successfully regardless of whether the email matches an account,
  # so this endpoint can't be used to enumerate registered emails (mirrors
  # Auth::AuthenticateUser's identical-message approach for the same reason).
  class RequestPasswordReset
    COOLDOWN = 30.seconds
    MAX_PER_HOUR = 5

    def initialize(email:)
      @email = email.to_s.strip.downcase
    end

    def call
      user = User.find_by("lower(email) = ?", @email)
      issue_challenge(user) if user && !rate_limited?(user)
      true
    end

    private

    def issue_challenge(user)
      challenge, code = VerificationChallenge.issue!(
        user: user, channel: "email", purpose: "password_reset", sent_to: user.email
      )
      if TestHelperAccess.enabled?
        Sidekiq.redis do |conn|
          conn.set(VerificationChallenge.test_cache_key(user_id: user.id, purpose: "password_reset"),
                    code, ex: VerificationChallenge::CODE_TTL.to_i)
        end
      end
      VerificationDeliveryJob.perform_later(challenge.id, code)
    end

    def rate_limited?(user)
      recent = user.verification_challenges.where(purpose: "password_reset")
      last = recent.order(created_at: :desc).first
      return true if last && last.created_at > COOLDOWN.ago

      recent.where(created_at: 1.hour.ago..).count >= MAX_PER_HOUR
    end
  end
end
