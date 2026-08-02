module Api
  module V1
    module Admin
      class ErrorLogsController < BaseController
        before_action :set_error_log, only: %i[show resolve reopen]

        # GET /api/v1/admin/error_logs?resolved=false&source=backend
        #
        # Ordered by last_seen_at so whatever is breaking right now floats to
        # the top, rather than by created_at (which for a long-lived recurring
        # error would bury it under newer one-offs).
        def index
          scope = ErrorLog.order(last_seen_at: :desc)
          if params[:resolved] == "false"
            scope = scope.unresolved
          elsif params[:resolved] == "true"
            scope = scope.where.not(resolved_at: nil)
          end
          scope = scope.where(source: params[:source]) if params[:source].present?

          render json: {
            error_logs: paginate(scope).map { |e| Admin::ErrorLogSerializer.call(e) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { error_log: Admin::ErrorLogSerializer.call(@error_log, include_backtrace: true) }
        end

        # POST /api/v1/admin/error_logs/:id/resolve
        def resolve
          @error_log.resolve!
          render json: { error_log: Admin::ErrorLogSerializer.call(@error_log, include_backtrace: true) }
        end

        # POST /api/v1/admin/error_logs/:id/reopen
        def reopen
          @error_log.reopen!
          render json: { error_log: Admin::ErrorLogSerializer.call(@error_log, include_backtrace: true) }
        end

        private

        def set_error_log
          @error_log = ErrorLog.find(params[:id])
        end
      end
    end
  end
end
