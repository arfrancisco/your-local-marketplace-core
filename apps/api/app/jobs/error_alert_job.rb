require "net/http"
require "json"

# Best-effort email alert for a newly-seen error, via Resend (same HTTP
# contract as FeedbackNotificationJob). Enqueued only on the first occurrence
# of a fingerprint — a repeating error must not flood the operator's inbox, so
# repeats only bump ErrorLog#occurrences_count and are seen in the admin panel.
#
# The error_logs row is already durably stored before this runs, so a provider
# outage or missing config should never fail loudly.
class ErrorAlertJob < ApplicationJob
  queue_as :default

  def perform(error_log_id)
    # Operator-awareness email, not something a developer testing locally
    # should ever trigger — a real RESEND_API_KEY sitting in a local .env
    # (e.g. to test the verification-code delivery flow) must not turn every
    # dev/test exception into a real message to a real inbox.
    return unless Rails.env.production?

    error_log = ErrorLog.find_by(id: error_log_id)
    return if error_log.nil?

    api_key = ENV["RESEND_API_KEY"]
    from_address = ENV["EMAIL_FROM_ADDRESS"]
    to_address = ENV["FEEDBACK_NOTIFICATION_EMAIL"]
    return if api_key.blank? || from_address.blank? || to_address.blank?

    uri = URI("https://api.resend.com/emails")
    path_line = error_log.request_path.present? ? "Path: #{error_log.request_method} #{error_log.request_path}\n" : ""
    user_line = error_log.user_id.present? ? "User: #{error_log.user_id}\n" : ""
    body = {
      to: [to_address],
      from: from_address,
      subject: "New KapitMarket PH error (#{error_log.source}): #{error_log.exception_class}",
      text: "Source: #{error_log.source}\n#{path_line}#{user_line}\n" \
            "#{error_log.exception_class}: #{error_log.message}\n\n#{error_log.backtrace}"
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
      Rails.logger.error("[ErrorAlert] provider call failed: #{response.code} #{response.body}")
    end
    response
  rescue StandardError => e
    Rails.logger.error("[ErrorAlert] provider call raised: #{e.class}: #{e.message}")
    nil
  end
end
