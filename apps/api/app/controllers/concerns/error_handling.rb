# Centralizes the API's error contract: every failure leaves as
#   { "error": { "code": ..., "message": ..., "details": ... } }
# with an appropriate HTTP status. Controllers and services never render errors
# by hand — they raise, and this maps the exception to the envelope.
module ErrorHandling
  extend ActiveSupport::Concern

  included do
    # StandardError is declared FIRST on purpose. rescue_from matches handlers
    # bottom-to-top (ActiveSupport::Rescuable#handler_for_rescue uses
    # `reverse_each`), so the *last* matching declaration wins. Putting the
    # catch-all at the top means every specific handler below it still takes
    # precedence; putting it at the bottom would swallow RecordNotFound,
    # NotAuthorizedError and friends and turn each of them into a 500.
    rescue_from StandardError, with: :render_internal_error
    rescue_from ApiError, with: :render_api_error
    rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
    rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid
    rescue_from ActionController::ParameterMissing, with: :render_parameter_missing
    rescue_from Pundit::NotAuthorizedError, with: :render_forbidden
  end

  private

  def render_error(code:, message:, status:, details: nil)
    payload = { code: code, message: message }
    payload[:details] = details if details.present?
    render json: { error: payload }, status: status
  end

  def render_api_error(error)
    render_error(code: error.code, message: error.message, status: error.status, details: error.details)
  end

  def render_not_found(_error)
    render_error(code: "not_found", message: "Not found", status: :not_found)
  end

  def render_record_invalid(error)
    render_error(
      code: "validation_failed",
      message: "Validation failed",
      status: :unprocessable_entity,
      details: error.record.errors.messages
    )
  end

  def render_parameter_missing(error)
    render_error(code: "parameter_missing", message: error.message, status: :bad_request)
  end

  def render_forbidden(_error)
    render_error(code: "forbidden", message: "You are not allowed to do that", status: :forbidden)
  end

  # Anything we did not anticipate. Without this the API would break its own
  # contract on an unexpected bug (bare Rails HTML 500 instead of the envelope
  # every other path returns), and the error would go unrecorded.
  #
  # The message is deliberately generic: internal exception text can leak
  # schema/config detail, and the real detail is in the error_logs row and the
  # first-occurrence email alert.
  def render_internal_error(error)
    Rails.logger.error("[InternalError] #{error.class}: #{error.message}\n#{Array(error.backtrace).first(20).join("\n")}")
    error_id = record_error_log(error)
    render_error(
      code: "internal_error",
      message: "Something went wrong on our end",
      status: :internal_server_error,
      details: error_id ? { error_id: error_id } : nil
    )
  end

  # Recording must never itself take down the response — if the database is the
  # thing that is broken, this write fails too, and the caller still deserves a
  # well-formed envelope rather than a second exception. Returns the recorded
  # ErrorLog's id (or nil if recording itself failed) so callers can hand it
  # back to the client as a correlation token for support/debugging.
  def record_error_log(error)
    log, newly_created = ErrorLog.record!(
      source: "backend",
      exception: error,
      request: request,
      user: (current_user rescue nil)
    )
    ErrorAlertJob.perform_later(log.id) if newly_created
    log.id
  rescue StandardError => e
    Rails.logger.error("[InternalError] failed to record error_log: #{e.class}: #{e.message}")
    nil
  end
end
