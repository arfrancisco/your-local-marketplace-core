require "rails_helper"

RSpec.describe "Api::V1 ClientErrors", type: :request do
  let(:payload) do
    {
      name: "TypeError",
      message: "Cannot read properties of undefined",
      stack: "at ShopList (ShopsPage.tsx:42:11)",
      source: "customer-web",
      url: "https://kapitmarket.ph/shops",
      user_agent: "Mozilla/5.0 (iPhone)"
    }
  end

  describe "POST /api/v1/client_errors" do
    it "accepts a report from an anonymous visitor" do
      expect {
        post "/api/v1/client_errors", params: payload
      }.to change(ErrorLog, :count).by(1)

      expect(response).to have_http_status(:created)
      log = ErrorLog.last
      expect(log.user).to be_nil
      expect(log.source).to eq("customer-web")
      expect(log.exception_class).to eq("TypeError")
      expect(log.request_path).to eq("https://kapitmarket.ph/shops")
    end

    it "returns the error_logs row id so the client can display it" do
      post "/api/v1/client_errors", params: payload
      expect(json["error_id"]).to eq(ErrorLog.last.id)
    end

    it "attributes the report to a signed-in user when a token is present" do
      customer = create(:user, :customer)
      post "/api/v1/client_errors", params: payload, headers: auth_headers(customer)

      expect(response).to have_http_status(:created)
      expect(ErrorLog.last.user).to eq(customer)
    end

    it "keeps the user agent alongside the stack" do
      post "/api/v1/client_errors", params: payload
      expect(ErrorLog.last.backtrace).to include("Mozilla/5.0 (iPhone)")
    end

    it "enqueues an alert only for the first occurrence" do
      expect {
        post "/api/v1/client_errors", params: payload
      }.to have_enqueued_job(ErrorAlertJob)

      expect {
        post "/api/v1/client_errors", params: payload
      }.not_to have_enqueued_job(ErrorAlertJob)

      expect(ErrorLog.last.occurrences_count).to eq(2)
    end

    it "does not trust an unrecognised source tag" do
      post "/api/v1/client_errors", params: payload.merge(source: "attacker-supplied")
      expect(ErrorLog.last.source).to eq("client-unknown")
    end

    it "accepts a bare report with no stack or url" do
      post "/api/v1/client_errors", params: { message: "Something broke", source: "admin-web" }

      expect(response).to have_http_status(:created)
      expect(ErrorLog.last.exception_class).to eq("ClientError")
    end

    it "accepts a request whose Origin is one of our own frontends" do
      post "/api/v1/client_errors", params: payload, headers: { "Origin" => "http://localhost:5173" }
      expect(response).to have_http_status(:created)
    end

    it "rejects a request whose Origin clearly isn't one of our own frontends" do
      post "/api/v1/client_errors", params: payload, headers: { "Origin" => "https://evil.example.com" }
      expect(response).to have_http_status(:forbidden)
    end

    it "falls back to Referer when Origin is absent" do
      post "/api/v1/client_errors", params: payload, headers: { "Referer" => "https://evil.example.com/whatever" }
      expect(response).to have_http_status(:forbidden)
    end

    it "does not block a request with neither header (not every real caller sends one)" do
      expect {
        post "/api/v1/client_errors", params: payload
      }.to change(ErrorLog, :count).by(1)
    end

    it "truncates an oversized payload instead of storing it unbounded" do
      post "/api/v1/client_errors", params: payload.merge(
        name: "X" * 1_000,
        message: "M" * 5_000,
        stack: "S" * 50_000
      )

      log = ErrorLog.last
      expect(log.exception_class.length).to eq(ErrorLog::ClientError::MAX_NAME_LENGTH)
      expect(log.message.length).to eq(ErrorLog::ClientError::MAX_MESSAGE_LENGTH)
      expect(log.backtrace.length).to be <= ErrorLog::ClientError::MAX_BACKTRACE_LENGTH
    end
  end
end
