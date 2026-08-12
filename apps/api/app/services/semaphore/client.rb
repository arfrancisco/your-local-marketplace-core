require "net/http"

module Semaphore
  # Shared Semaphore SMS transport, extracted from VerificationDeliveryJob's
  # previously-inline logic so a second call site (OrderNotificationJob)
  # doesn't have to duplicate the HTTP/timeout/error-handling contract and
  # drift out of sync over time. VerificationDeliveryJob's email/Resend path
  # (deliver_email, post_json) is untouched and stays where it is.
  #
  # Never raises — a provider outage shouldn't hit Sidekiq's retry storm for
  # something as time-sensitive as an OTP, or as low-stakes-if-delayed as an
  # order-status text. Failures are still recorded via
  # ErrorLog.record!/ErrorAlertJob so they're not invisible to the app's own
  # error monitoring, the same contract VerificationDeliveryJob already
  # established.
  #
  # Every ErrorLog.record! call here tags the failure with a `purpose`
  # ("otp" vs "order_notification") baked into the exception message, so a
  # real Semaphore outage doesn't collapse an auth-blocking OTP failure and a
  # merely-degraded order-notification failure onto the same alert
  # fingerprint (ErrorLog dedupes on exception class + message + top
  # backtrace line — see ErrorLog.fingerprint_for).
  class Client
    # The dedicated OTP endpoint (not the generic /messages one) routes over a
    # priority lane reserved for OTP traffic — still arrives during telco
    # congestion, unlike regular SMS — at 2 credits/message instead of 1.
    OTP_ENDPOINT = "https://api.semaphore.co/api/v4/otp".freeze

    # Generic messages endpoint — 1 credit/message, no priority-lane
    # protection during telco congestion. Accepted trade-off for
    # order-lifecycle notifications given cost (see the order-lifecycle-SMS
    # plan's "Design decisions").
    MESSAGES_ENDPOINT = "https://api.semaphore.co/api/v4/messages".freeze

    REQUEST_TIMEOUT_SECONDS = 10

    # Used by VerificationDeliveryJob#deliver_sms. `message` carries
    # Semaphore's `{otp}` placeholder, substituted server-side with `code` —
    # we pass our own already-generated code explicitly rather than letting
    # Semaphore auto-generate one, since ours is already hashed and stored in
    # verification_challenges; the code actually delivered has to be the one
    # we validate against.
    def self.send_otp(number:, code:, message:)
      api_key = ENV["SEMAPHORE_API_KEY"]
      return if api_key.blank?

      form = { apikey: api_key, number: number, message: message, code: code }
      sender_name = ENV["SEMAPHORE_SENDER_NAME"]
      form[:sendername] = sender_name if sender_name.present?

      post_form(URI(OTP_ENDPOINT), form, purpose: "otp")
    end

    # Used by OrderNotificationJob. Plain text message, no OTP placeholder.
    def self.send_message(number:, text:)
      api_key = ENV["SEMAPHORE_API_KEY"]
      return if api_key.blank?

      form = { apikey: api_key, number: number, message: text }
      sender_name = ENV["SEMAPHORE_SENDER_NAME"]
      form[:sendername] = sender_name if sender_name.present?

      post_form(URI(MESSAGES_ENDPOINT), form, purpose: "order_notification")
    end

    def self.post_form(uri, form, purpose:)
      request = Net::HTTP::Post.new(uri)
      request.set_form_data(form)
      perform_request(uri, request, purpose: purpose)
    end
    private_class_method :post_form

    def self.perform_request(uri, request, purpose:)
      response = Net::HTTP.start(
        uri.hostname, uri.port,
        use_ssl: true, open_timeout: REQUEST_TIMEOUT_SECONDS, read_timeout: REQUEST_TIMEOUT_SECONDS
      ) { |http| http.request(request) }
      unless response.is_a?(Net::HTTPSuccess)
        Rails.logger.error("[Semaphore::Client] (#{purpose}) provider call failed: #{response.code} #{response.body}")
        log, newly_created = ErrorLog.record!(
          source: "backend",
          exception: RuntimeError.new("Semaphore::Client (#{purpose}) provider call failed: #{response.code} #{response.body}")
        )
        ErrorAlertJob.perform_later(log.id) if newly_created
      end
      response
    rescue StandardError => e
      # See the class comment: never raise, but never let a failure go
      # unrecorded either. Re-tag the message with `purpose` (rather than
      # constructing a new exception of e's class, which may not accept a
      # single string argument the way every StandardError subclass we
      # actually see here does) so OTP vs order-notification failures get
      # distinct fingerprints even when the underlying exception class and
      # original message are identical (e.g. two Net::OpenTimeouts).
      Rails.logger.error("[Semaphore::Client] (#{purpose}) provider call raised: #{e.class}: #{e.message}")
      log, newly_created = ErrorLog.record!(
        source: "backend",
        exception: e.exception("(#{purpose}) #{e.message}")
      )
      ErrorAlertJob.perform_later(log.id) if newly_created
      nil
    end
    private_class_method :perform_request
  end
end
