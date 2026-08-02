require "rails_helper"

# Covers ErrorHandling's `rescue_from StandardError`: an *unexpected* exception
# must still leave through the API's standard error envelope, and must land in
# error_logs so we hear about it without a third-party monitoring service.
RSpec.describe "Api::V1 unhandled exceptions", type: :request do
  let(:customer) { create(:user, :customer) }

  before do
    # OrdersController#index requires auth (unlike ShopsController#index,
    # deliberately public for discovery) — needed so current_user is actually
    # set when the exception below is raised, for the user-attribution spec.
    allow_any_instance_of(Api::V1::OrdersController)
      .to receive(:index).and_raise(ZeroDivisionError, "divided by 0")
  end

  it "renders the standard JSON error envelope instead of a bare Rails 500" do
    get "/api/v1/orders", headers: auth_headers(customer)

    expect(response).to have_http_status(:internal_server_error)
    expect(response.content_type).to include("application/json")
    expect(json.dig("error", "code")).to eq("internal_error")
    expect(json.dig("error", "message")).to be_present
  end

  it "does not leak the internal exception message to the caller" do
    get "/api/v1/orders", headers: auth_headers(customer)
    expect(response.body).not_to include("divided by 0")
  end

  it "records an error_logs row attributed to the request and user" do
    expect {
      get "/api/v1/orders", headers: auth_headers(customer)
    }.to change(ErrorLog, :count).by(1)

    log = ErrorLog.last
    expect(log.source).to eq("backend")
    expect(log.exception_class).to eq("ZeroDivisionError")
    expect(log.message).to eq("divided by 0")
    expect(log.request_path).to eq("/api/v1/orders")
    expect(log.request_method).to eq("GET")
    expect(log.user_id).to eq(customer.id)
  end

  it "alerts on the first occurrence only, and counts the repeat" do
    expect {
      get "/api/v1/orders", headers: auth_headers(customer)
    }.to have_enqueued_job(ErrorAlertJob)

    expect {
      get "/api/v1/orders", headers: auth_headers(customer)
    }.not_to have_enqueued_job(ErrorAlertJob)

    expect(ErrorLog.last.occurrences_count).to eq(2)
  end

  it "still lets specific handlers win over the catch-all" do
    # Declared first so the specific rescues below it take precedence; if that
    # ordering ever regresses, these become 500s.
    allow_any_instance_of(Api::V1::OrdersController).to receive(:index)
      .and_raise(ActiveRecord::RecordNotFound)

    get "/api/v1/orders", headers: auth_headers(customer)

    expect(response).to have_http_status(:not_found)
    expect(json.dig("error", "code")).to eq("not_found")
  end

  it "does not record an error_log for an expected, already-handled error" do
    allow_any_instance_of(Api::V1::OrdersController).to receive(:index)
      .and_raise(ActiveRecord::RecordNotFound)

    expect {
      get "/api/v1/orders", headers: auth_headers(customer)
    }.not_to change(ErrorLog, :count)
  end
end
