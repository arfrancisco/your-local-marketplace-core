module Verifications
  # Issues a verification code for the given channel and hands the plaintext to a
  # background job for delivery. The plaintext never touches the database — only
  # its digest is stored on the challenge (see VerificationChallenge.issue!).
  class IssueChallenge
    CHANNEL_CONFIG = {
      "email" => { purpose: "email_verification", recipient: :email },
      "mobile" => { purpose: "mobile_verification", recipient: :mobile_number, model_channel: "sms" }
    }.freeze

    # Per-user and per-destination limits, on top of Rack::Attack's IP-level
    # throttle (config/initializers/rack_attack.rb) — this layer catches one
    # account (or one real phone number/email) being spammed regardless of
    # which IP the requests come from.
    COOLDOWN = 30.seconds
    MAX_PER_HOUR = 5

    def initialize(user:, channel:)
      @user = user
      @channel = channel.to_s
      @config = CHANNEL_CONFIG.fetch(@channel) do
        raise ApiError::UnprocessableEntity, "Unknown verification channel"
      end
    end

    def call
      @sent_to = @user.public_send(@config[:recipient])
      if @sent_to.blank?
        raise ApiError::UnprocessableEntity, "No #{@channel} on file to send a code to"
      end

      enforce_rate_limit!

      challenge, code = VerificationChallenge.issue!(
        user: @user,
        channel: @config[:model_channel] || @channel,
        purpose: @config[:purpose],
        sent_to: @sent_to
      )
      cache_code_for_e2e(@config[:purpose], code)
      VerificationDeliveryJob.perform_later(challenge.id, code)
      challenge
    end

    private

    # Uses Sidekiq's own Redis connection directly rather than Rails.cache —
    # Rails.cache defaults to :null_store in dev/test unless `rails dev:cache`
    # has been toggled on, which would make this silently do nothing. Redis
    # itself is already a hard dependency of this app (Sidekiq/ActiveJob), so
    # this doesn't add anything new.
    def cache_code_for_e2e(purpose, code)
      return unless TestHelperAccess.enabled?

      Sidekiq.redis do |conn|
        conn.set(VerificationChallenge.test_cache_key(user_id: @user.id, purpose: purpose),
                  code, ex: VerificationChallenge::CODE_TTL.to_i)
      end
    end

    def recent_challenges
      @user.verification_challenges.where(purpose: @config[:purpose])
    end

    # Scoped to the raw destination (sent_to), not @user — catches a specific
    # real phone number or email being harassed with repeat codes across
    # multiple accounts that have held it over time (e.g. a number freed up
    # by MeController#update and later claimed by someone else), which the
    # per-user check above can't see since each account's own count resets.
    # Does NOT catch a scripted attacker minting many distinct fake accounts
    # each with their own real-format number — User#mobile_number/#email are
    # both unique, so that pattern never touches the same destination twice
    # regardless of scoping. That's a source (IP)-side problem, handled
    # separately by Rack::Attack's register-specific throttle.
    def recent_challenges_to_destination
      VerificationChallenge.where(sent_to: @sent_to, purpose: @config[:purpose])
    end

    def enforce_rate_limit!
      last = recent_challenges.order(created_at: :desc).first
      if last && last.created_at > COOLDOWN.ago
        retry_after = (COOLDOWN - (Time.current - last.created_at)).ceil
        raise ApiError.new(
          "Please wait a moment before requesting another code.",
          code: "rate_limited", status: :too_many_requests, details: { retry_after: retry_after }
        )
      end

      count_last_hour = recent_challenges.where(created_at: 1.hour.ago..).count
      if count_last_hour >= MAX_PER_HOUR
        raise ApiError.new(
          "Too many code requests. Try again later.",
          code: "rate_limited", status: :too_many_requests
        )
      end

      destination_count_last_hour = recent_challenges_to_destination.where(created_at: 1.hour.ago..).count
      if destination_count_last_hour >= MAX_PER_HOUR
        raise ApiError.new(
          "Too many code requests to this number. Try again later.",
          code: "rate_limited", status: :too_many_requests
        )
      end
    end
  end
end
