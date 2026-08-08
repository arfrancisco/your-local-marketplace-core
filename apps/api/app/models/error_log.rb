require "digest"

# One row per distinct error, not per occurrence. Errors repeat — a flaky
# endpoint can throw the same exception hundreds of times an hour — so rows are
# deduped by a `fingerprint` (exception class + message + top backtrace line)
# with a unique index behind it, and repeats just bump `occurrences_count`.
#
# This is deliberately the whole of our error monitoring: no Sentry, no
# third-party SDK. Alerting reuses Resend (ErrorAlertJob) and browsing reuses
# the admin panel, both of which already exist.
class ErrorLog < ApplicationRecord
  belongs_to :user, optional: true

  validates :source, :exception_class, :message, :fingerprint, presence: true

  scope :unresolved, -> { where(resolved_at: nil) }

  # request_path is unbounded in the schema (a plain Rails string column),
  # and — unlike a real ActionDispatch::Request#path — the "request" handed
  # to `record!` for a client-reported error is a caller-controlled `url`
  # value from a public endpoint (see ClientErrorsController::ClientRequest).
  # Bounding it here, not per-caller, closes that off structurally for
  # anything that calls `record!`, not just today's one caller.
  MAX_REQUEST_PATH_LENGTH = 2_000

  # A browser-reported error, shaped just enough to walk through `record!`
  # alongside real server-side exceptions. `name` is what distinguishes it from
  # a real Exception, whose class name is the thing worth recording.
  #
  # Unlike a real Exception (raised by our own code, so effectively bounded in
  # size), every field here is attacker-controlled free text from a public,
  # unauthenticated endpoint (Api::V1::ClientErrorsController) — truncate
  # before it ever reaches `message`/`backtrace` columns, on top of (not
  # instead of) the rate limit that caps how often it can happen at all.
  class ClientError
    MAX_NAME_LENGTH = 255
    MAX_MESSAGE_LENGTH = 2_000
    MAX_BACKTRACE_LENGTH = 10_000

    attr_reader :name, :message, :backtrace

    def initialize(name:, message:, backtrace: nil)
      @name = name.presence&.slice(0, MAX_NAME_LENGTH) || "ClientError"
      @message = message.to_s.slice(0, MAX_MESSAGE_LENGTH)
      @backtrace = backtrace.to_s.slice(0, MAX_BACKTRACE_LENGTH).split("\n")
    end
  end

  def resolved?
    resolved_at.present?
  end

  def resolve!
    update!(resolved_at: Time.current)
  end

  def reopen!
    update!(resolved_at: nil)
  end

  # Records one occurrence of an error and returns [error_log, newly_created].
  # Callers use the boolean to decide whether to alert: only a genuinely new
  # fingerprint is worth an email, otherwise a repeating error floods the inbox.
  def self.record!(source:, exception:, request: nil, user: nil)
    # Explicit type check, not `respond_to?(:name)` — NameError/NoMethodError
    # define their own #name (the missing method/constant), so duck-typing here
    # would record a NoMethodError as "foo" instead of "NoMethodError".
    exception_class = exception.is_a?(ClientError) ? exception.name.to_s : exception.class.name
    message = exception.message.to_s
    backtrace = Array(exception.backtrace)
    fingerprint = fingerprint_for(exception_class, message, backtrace.first)

    log = find_or_initialize_by(fingerprint: fingerprint)
    return [touch_occurrence!(log), false] unless log.new_record?

    log.assign_attributes(
      source: source,
      exception_class: exception_class.presence || "UnknownError",
      message: message.presence || "(no message)",
      backtrace: backtrace.join("\n").presence,
      request_path: request&.path&.slice(0, MAX_REQUEST_PATH_LENGTH),
      request_method: request&.request_method,
      user_id: user&.id,
      occurrences_count: 1,
      first_seen_at: Time.current,
      last_seen_at: Time.current
    )
    log.save!
    [log, true]
  rescue ActiveRecord::RecordNotUnique
    # Two processes hit a brand-new fingerprint at the same moment. The unique
    # index did its job; re-read the winner and count this as a repeat so the
    # caller does not send a second alert for the same error.
    [touch_occurrence!(find_by!(fingerprint: fingerprint)), false]
  end

  def self.fingerprint_for(exception_class, message, top_backtrace_line)
    Digest::SHA256.hexdigest([exception_class, message, top_backtrace_line].map(&:to_s).join("\n"))
  end

  def self.touch_occurrence!(log)
    log.update!(occurrences_count: log.occurrences_count + 1, last_seen_at: Time.current)
    log
  end
  private_class_method :touch_occurrence!
end
