module Admin
  module AuditLogSerializer
    module_function

    def call(audit_log)
      {
        id: audit_log.id,
        admin_user_id: audit_log.admin_user_id,
        admin_user_email: audit_log.admin_user&.email,
        http_method: audit_log.http_method,
        path: audit_log.path,
        controller: audit_log.controller,
        action: audit_log.action,
        resource_type: audit_log.resource_type,
        resource_id: audit_log.resource_id,
        status_code: audit_log.status_code,
        request_params: audit_log.request_params,
        ip_address: audit_log.ip_address,
        created_at: audit_log.created_at
      }
    end
  end
end
