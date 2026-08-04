module Api
  module V1
    module Admin
      # Read-only. Rows are written by BaseController's record_audit_log
      # around_action, never by hand here.
      class AuditLogsController < BaseController
        before_action :set_audit_log, only: :show

        # GET /api/v1/admin/audit_logs?admin_user_id=1&resource_type=User
        def index
          scope = AdminAuditLog.order(created_at: :desc)
          scope = scope.where(admin_user_id: params[:admin_user_id]) if params[:admin_user_id].present?
          scope = scope.where(resource_type: params[:resource_type]) if params[:resource_type].present?
          render json: {
            audit_logs: paginate(scope).map { |log| ::Admin::AuditLogSerializer.call(log) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { audit_log: ::Admin::AuditLogSerializer.call(@audit_log) }
        end

        private

        def set_audit_log
          @audit_log = AdminAuditLog.find(params[:id])
        end
      end
    end
  end
end
