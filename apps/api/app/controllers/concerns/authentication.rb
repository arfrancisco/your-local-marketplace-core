# Bearer-token authentication for the stateless API. Clients send
#   Authorization: Bearer <token>
# The raw token is looked up by its digest (see ApiToken). Controllers call
# `authenticate!` in a before_action to require a signed-in user; `current_user`
# is available everywhere.
module Authentication
  extend ActiveSupport::Concern

  included do
    attr_reader :current_user
  end

  private

  def authenticate!
    token = ApiToken.authenticate(bearer_token)
    raise ApiError::Unauthorized if token.nil?

    token.touch_usage!
    @current_api_token = token
    @current_user = token.user
  end

  def current_api_token
    @current_api_token
  end

  def bearer_token
    header = request.authorization.to_s
    header[/\ABearer (.+)\z/, 1]
  end
end
