require "net/http"
require "json"

# Delivers a verification code out of band, via Semaphore (SMS) or Resend
# (email). Runs on Sidekiq in production; inline/async elsewhere.
#
# Provider credentials are optional at the ENV level on purpose: until they're
# provisioned, this job just logs the code (same as before a real provider was
# wired up), so local dev/test/demo keep working with zero external calls.
class VerificationDeliveryJob < ApplicationJob
  queue_as :default

  # The dedicated OTP endpoint (not the generic /messages one) routes over a
  # priority lane reserved for OTP traffic — still arrives during telco
  # congestion, unlike regular SMS — at 2 credits/message instead of 1.
  # Since all of our Semaphore traffic is OTP delivery, this is a strict
  # improvement with no downside.
  SEMAPHORE_ENDPOINT = "https://api.semaphore.co/api/v4/otp".freeze

  def perform(challenge_id, code)
    challenge = VerificationChallenge.find_by(id: challenge_id)
    return if challenge.nil? || challenge.consumed?

    Rails.logger.info(
      "[VerificationDelivery] channel=#{challenge.channel} to=#{challenge.sent_to} " \
      "code=#{code} (also see real provider call below, if configured)"
    )

    case challenge.channel
    when "email" then deliver_email(challenge, code)
    when "sms" then deliver_sms(challenge, code)
    end
  end

  private

  def deliver_email(challenge, code)
    api_key = ENV["RESEND_API_KEY"]
    from_address = ENV["EMAIL_FROM_ADDRESS"]
    return if api_key.blank? || from_address.blank?

    uri = URI("https://api.resend.com/emails")
    body = {
      to: [challenge.sent_to],
      from: from_address,
      subject: "Your KapitMarket PH verification code",
      text: "Your verification code is #{code}. It expires in 10 minutes. " \
            "If you didn't request this, you can ignore this email.",
      html: <<~HTML
        <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; color: #1a1a1a; max-width: 480px;">
          <p style="margin: 0 0 20px;">Your KapitMarket PH verification code is:</p>
          <p style="font-size: 36px; font-weight: 700; letter-spacing: 6px; margin: 0 0 20px;">#{code}</p>
          <p style="margin: 0; color: #555;">It expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
        </div>
      HTML
    }

    post_json(uri, body, headers: { "Authorization" => "Bearer #{api_key}" })
  end

  def deliver_sms(challenge, code)
    api_key = ENV["SEMAPHORE_API_KEY"]
    return if api_key.blank?

    sender_name = ENV["SEMAPHORE_SENDER_NAME"]
    form = {
      apikey: api_key,
      number: challenge.sent_to,
      # {otp} is Semaphore's placeholder — substituted with the `code` param
      # below. We pass our own already-generated code explicitly rather than
      # letting Semaphore auto-generate one, since ours is already hashed
      # and stored in verification_challenges; the code actually delivered
      # has to be the one we validate against.
      message: "Your KapitMarket PH verification code is {otp}. It expires in 10 minutes.",
      code: code
    }
    form[:sendername] = sender_name if sender_name.present?

    uri = URI(SEMAPHORE_ENDPOINT)
    post_form(uri, form)
  end

  def post_json(uri, body, headers: {})
    request = Net::HTTP::Post.new(uri)
    request["Content-Type"] = "application/json"
    headers.each { |k, v| request[k] = v }
    request.body = body.to_json
    perform_request(uri, request)
  end

  def post_form(uri, form)
    request = Net::HTTP::Post.new(uri)
    request.set_form_data(form)
    perform_request(uri, request)
  end

  def perform_request(uri, request)
    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(request) }
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error("[VerificationDelivery] provider call failed: #{response.code} #{response.body}")
      log, newly_created = ErrorLog.record!(
        source: "backend",
        exception: RuntimeError.new("VerificationDelivery provider call failed: #{response.code} #{response.body}")
      )
      ErrorAlertJob.perform_later(log.id) if newly_created
    end
    response
  rescue StandardError => e
    # A provider outage shouldn't raise into Sidekiq's retry storm for something
    # as time-sensitive as an OTP — log it, the user can just tap "resend". But
    # "don't raise" isn't "don't record" — this used to be genuinely invisible
    # to the app's own error monitoring (built specifically to catch this
    # class of failure), since raising is the only thing that reaches
    # ApplicationJob's rescue_from. Recording it here directly closes that gap
    # without changing the no-raise behavior.
    Rails.logger.error("[VerificationDelivery] provider call raised: #{e.class}: #{e.message}")
    log, newly_created = ErrorLog.record!(source: "backend", exception: e)
    ErrorAlertJob.perform_later(log.id) if newly_created
    nil
  end
end
