class ApplicationJob < ActiveJob::Base
  # Automatically retry jobs that encountered a deadlock
  # retry_on ActiveRecord::Deadlocked

  # Most jobs are safe to ignore if the underlying records are no longer available
  # discard_on ActiveJob::DeserializationError

  # Mirrors ErrorHandling's controller-side capture (see
  # app/controllers/concerns/error_handling.rb#record_error_log) for
  # background jobs: without this, a raising job was only visible via
  # Sidekiq's own retry/dead-set UI or STDOUT, never in error_logs/the admin
  # panel. This only *observes* the exception — `raise exception` at the end
  # re-raises it immediately, so ActiveJob/Sidekiq's own retry/dead-set
  # behavior is completely unaffected; a `rescue_from` block that does not
  # re-raise would otherwise swallow it and silently break retries.
  rescue_from(StandardError) do |exception|
    record_job_error_log(exception)
    raise exception
  end

  private

  # A job has no HTTP request/current_user, so those args to ErrorLog.record!
  # are simply omitted (both default to nil there) rather than force-fit.
  def record_job_error_log(exception)
    log, newly_created = ErrorLog.record!(source: "backend", exception: exception)
    ErrorAlertJob.perform_later(log.id) if newly_created
  rescue StandardError => e
    Rails.logger.error("[ApplicationJob] failed to record error_log: #{e.class}: #{e.message}")
  end
end
