require "net/http"
require "json"

# Best-effort email notification for a new feedback submission, via
# Cloudflare Email Service (same HTTP contract as VerificationDeliveryJob).
# The submission itself is already durably stored before this runs — this is
# just for immediate visibility during the beta, so a provider outage or
# missing config should never fail loudly.
class FeedbackNotificationJob < ApplicationJob
  queue_as :default

  def perform(feedback_submission_id)
    submission = FeedbackSubmission.find_by(id: feedback_submission_id)
    return if submission.nil?

    account_id = ENV["CLOUDFLARE_ACCOUNT_ID"]
    api_token = ENV["CLOUDFLARE_EMAIL_API_TOKEN"]
    from_address = ENV["EMAIL_FROM_ADDRESS"]
    to_address = ENV["FEEDBACK_NOTIFICATION_EMAIL"]
    return if account_id.blank? || api_token.blank? || from_address.blank? || to_address.blank?

    uri = URI("https://api.cloudflare.com/client/v4/accounts/#{account_id}/email/sending/send")
    reply_line = submission.email.present? ? "From: #{submission.email}\n" : ""
    page_line = submission.page_url.present? ? "Page: #{submission.page_url}\n" : ""
    body = {
      to: to_address,
      from: from_address,
      subject: "New KapitMarket PH beta feedback (##{submission.id})",
      text: "#{reply_line}#{page_line}\n#{submission.message}"
    }

    post_json(uri, body, headers: { "Authorization" => "Bearer #{api_token}" })
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
