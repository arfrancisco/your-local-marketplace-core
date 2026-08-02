module Admin
  module ErrorLogSerializer
    module_function

    # Backtraces are large and the index renders up to 200 rows, so the full
    # text is only included on the detail view (`include_backtrace: true`).
    def call(error_log, include_backtrace: false)
      payload = {
        id: error_log.id,
        source: error_log.source,
        exception_class: error_log.exception_class,
        message: error_log.message,
        request_path: error_log.request_path,
        request_method: error_log.request_method,
        user_id: error_log.user_id,
        fingerprint: error_log.fingerprint,
        occurrences_count: error_log.occurrences_count,
        first_seen_at: error_log.first_seen_at,
        last_seen_at: error_log.last_seen_at,
        resolved: error_log.resolved?,
        resolved_at: error_log.resolved_at,
        created_at: error_log.created_at
      }
      payload[:backtrace] = error_log.backtrace if include_backtrace
      payload
    end
  end
end
