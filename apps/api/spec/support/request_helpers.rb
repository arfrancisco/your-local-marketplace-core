# Helpers for request specs: build an Authorization header for a user by minting
# a real token, and parse the JSON response body.
module RequestHelpers
  def auth_headers(user)
    _record, raw = ApiToken.issue!(user)
    { "Authorization" => "Bearer #{raw}" }
  end

  # Zero-arg-callable so the ~40 existing `headers: admin_auth_headers` call
  # sites across the admin request specs don't need to change — defaults to
  # a freshly created admin. Pass an explicit admin_user when a spec needs to
  # assert something about *which* admin performed the request (e.g. audit
  # log attribution).
  def admin_auth_headers(admin_user = nil)
    admin_user ||= FactoryBot.create(:admin_user)
    _record, raw = AdminApiToken.issue!(admin_user)
    { "Authorization" => "Bearer #{raw}" }
  end

  def json
    JSON.parse(response.body)
  end
end

RSpec.configure do |config|
  config.include RequestHelpers, type: :request
end
