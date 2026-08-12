require "rails_helper"

# Rack::Attack is disabled in the test environment by default, and even when
# enabled it counts against Rails.cache -- which is :null_store in both test
# and (by default) development, so counts never persist there either way. To
# actually exercise a throttle here, both need to be overridden for the
# duration of the example: enabled: true, plus a real (in-memory) cache store
# scoped to Rack::Attack specifically, independent of Rails.cache.
RSpec.describe "Rack::Attack throttling", type: :request do
  around do |example|
    original_enabled = Rack::Attack.enabled
    original_store = Rack::Attack.cache.store

    Rack::Attack.enabled = true
    Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new

    example.run

    Rack::Attack.enabled = original_enabled
    Rack::Attack.cache.store = original_store
  end

  it "throttles public discovery at 120 requests per minute per IP" do
    headers = auth_headers(create(:user, :customer, :verified))

    120.times { get "/api/v1/shops", headers: headers }
    get "/api/v1/shops", headers: headers

    expect(response).to have_http_status(:too_many_requests)
    expect(json.dig("error", "code")).to eq("rate_limited")
  end

  it "throttles short-link redirects at 120 requests per minute per IP" do
    order = create(:order)
    short_link = ShortLink.for(order: order, audience: "customer")

    120.times { get "/s/#{short_link.code}" }
    get "/s/#{short_link.code}"

    expect(response).to have_http_status(:too_many_requests)
    expect(json.dig("error", "code")).to eq("rate_limited")
  end

  it "does not throttle a short-link redirect under the limit" do
    order = create(:order)
    short_link = ShortLink.for(order: order, audience: "customer")

    get "/s/#{short_link.code}"

    expect(response).to have_http_status(:found)
  end

  def register_params(i)
    {
      user: {
        email: "throttle-test-#{i}@example.com", password: "sup3rsecret",
        mobile_number: format("+639170000%03d", i), is_resident: false, terms_accepted: true
      }
    }
  end

  it "throttles registration at 5 requests per minute per IP, alerting once" do
    expect {
      5.times { |i| post "/api/v1/auth/register", params: register_params(i) }
      post "/api/v1/auth/register", params: register_params(5)
    }.to change(ErrorLog, :count).by(1).and have_enqueued_job(ErrorAlertJob)

    expect(response).to have_http_status(:too_many_requests)
    expect(ErrorLog.last.exception_class).to eq("Rack::Attack::RegisterThrottleExceeded")
  end

  it "does not throttle login at the tighter register limit" do
    user = create(:user, :customer, password: "sup3rsecret")

    6.times { post "/api/v1/auth/login", params: { email: user.email, password: "sup3rsecret" } }

    expect(response).not_to have_http_status(:too_many_requests)
  end
end
