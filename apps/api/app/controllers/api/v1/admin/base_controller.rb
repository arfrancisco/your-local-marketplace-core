module Api
  module V1
    module Admin
      # One shared operator credential (ADMIN_USERNAME/PASSWORD), not a User
      # role — mirrors the Sidekiq::Web guard in config/routes.rb. There is
      # one admin, no per-admin accounts, so HTTP Basic Auth *is* the
      # authorization boundary for this entire namespace; Pundit is
      # deliberately not used here, there's nothing finer-grained to express
      # once authenticate_admin! passes.
      #
      # This inherits ApplicationController directly (not Api::V1::BaseController)
      # since the normal bearer-token `authenticate!` is a completely separate
      # concern from admin Basic Auth, and admin requests never carry a
      # customer/vendor token.
      class BaseController < ApplicationController
        before_action :authenticate_admin!

        private

        # ActionController::API does not include HttpAuthentication::Basic
        # (no authenticate_or_request_with_http_basic available), so this is
        # hand-rolled the same way Authentication#bearer_token is.
        def authenticate_admin!
          username, password = decode_basic_auth
          expected_user = ENV.fetch("ADMIN_USERNAME", "admin")
          expected_pass = ENV.fetch("ADMIN_PASSWORD", "admin")

          valid = username.present? && password.present? &&
            ActiveSupport::SecurityUtils.secure_compare(username, expected_user) &
            ActiveSupport::SecurityUtils.secure_compare(password, expected_pass)

          return if valid

          response.set_header("WWW-Authenticate", 'Basic realm="KapitMarket Admin"')
          raise ApiError::Unauthorized
        end

        def decode_basic_auth
          header = request.authorization.to_s
          return [nil, nil] unless header.start_with?("Basic ")

          Base64.decode64(header.delete_prefix("Basic ")).split(":", 2)
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
