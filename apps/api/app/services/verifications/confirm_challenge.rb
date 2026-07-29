module Verifications
  # Confirms a submitted code against the user's most recent live challenge for
  # the channel, and stamps the matching verified_at column on success.
  class ConfirmChallenge
    CHANNEL_CONFIG = {
      "email" => { purpose: "email_verification", verified_column: :email_verified_at },
      "mobile" => { purpose: "mobile_verification", verified_column: :mobile_verified_at }
    }.freeze

    def initialize(user:, channel:, code:)
      @user = user
      @code = code
      @config = CHANNEL_CONFIG.fetch(channel.to_s) do
        raise ApiError::UnprocessableEntity, "Unknown verification channel"
      end
    end

    def call
      challenge = @user.verification_challenges
                       .live
                       .where(purpose: @config[:purpose])
                       .order(created_at: :desc)
                       .first
      raise ApiError::UnprocessableEntity, "No active verification code. Request a new one." if challenge.nil?
      raise ApiError::UnprocessableEntity, "Invalid or expired code" unless challenge.verify(@code)

      @user.update!(@config[:verified_column] => Time.current)
      @user
    end
  end
end
