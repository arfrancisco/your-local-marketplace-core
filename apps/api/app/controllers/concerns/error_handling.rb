# Centralizes the API's error contract: every failure leaves as
#   { "error": { "code": ..., "message": ..., "details": ... } }
# with an appropriate HTTP status. Controllers and services never render errors
# by hand — they raise, and this maps the exception to the envelope.
module ErrorHandling
  extend ActiveSupport::Concern

  included do
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
end
