# Bearer-token authentication for the admin surface. Clients send
#   Authorization: Bearer <token>
# The raw token is looked up by its digest (see AdminApiToken). Mirrors the
# top-level Authentication concern; kept as a fully separate concern (rather
# than extending that one) so the admin security boundary stays architecturally
# isolated from customer/vendor auth.
#
# Deactivated admins are rejected here, on every request — not just at
# login — so revoking an admin's access (AdminUsersController#deactivate)
# takes effect immediately, not just for future logins.
module Admin
  module Authentication
    extend ActiveSupport::Concern

    included do
      attr_reader :current_admin_user
    end

    private

    def authenticate_admin!
      token = AdminApiToken.authenticate(bearer_token)
      raise ApiError::Unauthorized if token.nil? || !token.admin_user.active?

      token.touch_usage!
      @current_admin_api_token = token
      @current_admin_user = token.admin_user
    end

    def current_admin_api_token
      @current_admin_api_token
    end

    def bearer_token
      header = request.authorization.to_s
      header[/\ABearer (.+)\z/, 1]
    end
  end
end
