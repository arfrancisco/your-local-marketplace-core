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
end
