module Verifications
  # Issues a verification code for the given channel and hands the plaintext to a
  # background job for delivery. The plaintext never touches the database — only
  # its digest is stored on the challenge (see VerificationChallenge.issue!).
  class IssueChallenge
    CHANNEL_CONFIG = {
      "email" => { purpose: "email_verification", recipient: :email },
      "mobile" => { purpose: "mobile_verification", recipient: :mobile_number, model_channel: "sms" }
    }.freeze

    def initialize(user:, channel:)
      @user = user
      @channel = channel.to_s
      @config = CHANNEL_CONFIG.fetch(@channel) do
        raise ApiError::UnprocessableEntity, "Unknown verification channel"
      end
    end

    def call
      sent_to = @user.public_send(@config[:recipient])
      if sent_to.blank?
        raise ApiError::UnprocessableEntity, "No #{@channel} on file to send a code to"
      end

      challenge, code = VerificationChallenge.issue!(
        user: @user,
        channel: @config[:model_channel] || @channel,
        purpose: @config[:purpose],
        sent_to: sent_to
      )
      VerificationDeliveryJob.perform_later(challenge.id, code)
      challenge
    end
  end
end
