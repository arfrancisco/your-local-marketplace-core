module ApplicationCable
  # WebSocket connections can't send an Authorization header, so the client
  # passes the same bearer token as a query param instead (e.g.
  # wss://.../cable?token=...), reusing the existing ApiToken scheme.
  class Connection < ActionCable::Connection::Base
    identified_by :current_user

    def connect
      self.current_user = find_verified_user
    end

    private

    def find_verified_user
      token = ApiToken.authenticate(request.params[:token])
      reject_unauthorized_connection if token.nil?

      token.touch_usage!
      token.user
    end
  end
end
