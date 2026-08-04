module Api
  module V1
    module Admin
      # Real per-admin accounts + bearer-token sessions (see
      # docs/adr/0010-per-admin-accounts.md) — replaces the old shared
      # Basic-Auth credential. Pundit is still deliberately not used here:
      # every authenticated admin has the same authorization level, there's
      # nothing finer-grained to express once authenticate_admin! passes.
      #
      # This inherits ApplicationController directly (not Api::V1::BaseController)
      # since the normal bearer-token `authenticate!` is a completely separate
      # concern from admin auth, and admin requests never carry a
      # customer/vendor token.
      class BaseController < ApplicationController
        include ::Admin::Authentication

        before_action :authenticate_admin!
        around_action :record_audit_log

        MUTATING_METHODS = %w[POST PATCH PUT DELETE].freeze

        private

        # Best-effort "who did this" trail: fires for any mutating request
        # once current_admin_user is set (SessionsController#create skips
        # authenticate_admin! and so is never attributed — there's no admin
        # yet to attribute it to). Wrapped so a raised/rescued exception
        # (ApiError, RecordNotFound, etc., all handled by ErrorHandling's
        # rescue_from) still gets logged with the status it will end up
        # rendering as, not the default 200 the response happens to carry
        # mid-unwind.
        def record_audit_log
          yield
          write_audit_log(response.status) if mutating_request?
        rescue StandardError => e
          write_audit_log(exception_status_code(e)) if mutating_request?
          raise
        end

        def mutating_request?
          MUTATING_METHODS.include?(request.method)
        end

        def write_audit_log(status)
          return unless current_admin_user

          AdminAuditLog.create!(
            admin_user: current_admin_user,
            http_method: request.method,
            path: request.path,
            controller: controller_path,
            action: action_name,
            resource_type: audit_resource_type,
            resource_id: params[:id],
            status_code: status,
            request_params: request.filtered_parameters.except("controller", "action"),
            ip_address: request.remote_ip
          )
        rescue StandardError => e
          Rails.logger.error("[AdminAuditLog] failed to record: #{e.class}: #{e.message}")
        end

        # Approximate on purpose — inferred from the controller name, not a
        # declared mapping per controller. Good enough for "who touched
        # roughly what," which is the actual ask.
        def audit_resource_type
          controller_name.classify
        rescue StandardError
          nil
        end

        def exception_status_code(exception)
          case exception
          when ApiError
            Rack::Utils.status_code(exception.status)
          when ActiveRecord::RecordNotFound
            404
          when ActiveRecord::RecordInvalid
            422
          when ActionController::ParameterMissing
            400
          when Pundit::NotAuthorizedError
            403
          else
            500
          end
        end

        # Shared hand-rolled pagination — no pagination gem in the Gemfile,
        # and admin list sizes don't warrant adding one at this scale.
        def paginate(scope)
          scope.limit(per_page).offset((page - 1) * per_page)
        end

        def pagination_meta(scope)
          { page: page, per_page: per_page, total_count: scope.count }
        end

        def page
          [params[:page].to_i, 1].max
        end

        def per_page
          (params[:per_page].presence || 50).to_i.clamp(1, 200)
        end
      end
    end
  end
end
