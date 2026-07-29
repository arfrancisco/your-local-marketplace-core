# Delivers a verification code out of band. There is no email/SMS provider wired
# up in this phase, so the job just logs the code — this is the single seam where
# a real provider (Postmark, Twilio, etc.) plugs in later. Runs on Sidekiq in
# production; inline/async elsewhere.
class VerificationDeliveryJob < ApplicationJob
  queue_as :default

  def perform(challenge_id, code)
    challenge = VerificationChallenge.find_by(id: challenge_id)
    return if challenge.nil? || challenge.consumed?

    Rails.logger.info(
      "[VerificationDelivery] channel=#{challenge.channel} to=#{challenge.sent_to} " \
      "code=#{code} (dev-only log; wire a real provider here)"
    )
  end
end
