module Admin
  module VerificationChallengeSerializer
    module_function

    # Never code_digest.
    def call(challenge)
      {
        id: challenge.id,
        user_id: challenge.user_id,
        channel: challenge.channel,
        purpose: challenge.purpose,
        sent_to: challenge.sent_to,
        expired: challenge.expired?,
        consumed: challenge.consumed?,
        consumed_at: challenge.consumed_at,
        attempts_count: challenge.attempts_count,
        expires_at: challenge.expires_at,
        created_at: challenge.created_at
      }
    end
  end
end
