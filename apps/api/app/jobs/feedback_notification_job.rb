require "net/http"
require "json"

# Best-effort email notification for a new feedback submission, via Resend
# (same HTTP contract as VerificationDeliveryJob). The submission itself is
# already durably stored before this runs — this is just for immediate
# visibility during the beta, so a provider outage or missing config should
# never fail loudly.
class FeedbackNotificationJob < ApplicationJob
  queue_as :default

  def perform(feedback_submission_id)
    # Operator-awareness email, not something a developer testing locally
    # should ever trigger — a real RESEND_API_KEY sitting in a local .env
    # (e.g. to test the verification-code delivery flow) must not turn every
    # dev/test feedback submission into a real message to a real inbox.
    return unless Rails.env.production?

    submission = FeedbackSubmission.find_by(id: feedback_submission_id)
    return if submission.nil?

    api_key = ENV["RESEND_API_KEY"]
    from_address = ENV["EMAIL_FROM_ADDRESS"]
    to_address = ENV["FEEDBACK_NOTIFICATION_EMAIL"]
    return if api_key.blank? || from_address.blank? || to_address.blank?

    uri = URI("https://api.resend.com/emails")
    reply_line = submission.email.present? ? "From: #{submission.email}\n" : ""
    page_line = submission.page_url.present? ? "Page: #{submission.page_url}\n" : ""
    body = {
      to: [to_address],
      from: from_address,
      subject: "New KapitMarket PH beta feedback (##{submission.id})",
      text: "#{reply_line}#{page_line}\n#{submission.message}"
    }

    post_json(uri, body, headers: { "Authorization" => "Bearer #{api_key}" })
  end

  private

  def post_json(uri, body, headers: {})
    request = Net::HTTP::Post.new(uri)
    request["Content-Type"] = "application/json"
    headers.each { |k, v| request[k] = v }
    request.body = body.to_json
    response = Net::HTTP.start(uri.hostname, uri.port, use_ssl: true) { |http| http.request(request) }
    unless response.is_a?(Net::HTTPSuccess)
      Rails.logger.error("[FeedbackNotification] provider call failed: #{response.code} #{response.body}")
    end
    response
  rescue StandardError => e
    Rails.logger.error("[FeedbackNotification] provider call raised: #{e.class}: #{e.message}")
    nil
  end
end
