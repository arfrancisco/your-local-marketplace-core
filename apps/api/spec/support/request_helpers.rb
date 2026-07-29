# Helpers for request specs: build an Authorization header for a user by minting
# a real token, and parse the JSON response body.
module RequestHelpers
  def auth_headers(user)
    _record, raw = ApiToken.issue!(user)
    { "Authorization" => "Bearer #{raw}" }
  end

  def json
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
end
