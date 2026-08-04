require "rails_helper"

RSpec.describe "Api::V1::Admin::ErrorLogs", type: :request do
  def record(source: "backend", klass: "ArgumentError", message: "boom", stack: "app.rb:1")
    ErrorLog.create!(
      source: source,
      exception_class: klass,
      message: message,
      backtrace: stack,
      fingerprint: ErrorLog.fingerprint_for(klass, message, stack),
      occurrences_count: 1,
      first_seen_at: Time.current,
      last_seen_at: Time.current
    )
  end

  describe "GET /api/v1/admin/error_logs" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/error_logs" }

    it_behaves_like "requires admin auth"

    it "filters by resolved" do
      record(message: "resolved one").resolve!
      record(message: "still broken")

      get "/api/v1/admin/error_logs", params: { resolved: "false" }, headers: admin_auth_headers
      expect(json["error_logs"].map { |e| e["message"] }).to eq(["still broken"])
    end

    it "filters by source" do
      record(source: "backend", message: "server side")
      record(source: "customer-web", message: "browser side")

      get "/api/v1/admin/error_logs", params: { source: "customer-web" }, headers: admin_auth_headers
      expect(json["error_logs"].map { |e| e["message"] }).to eq(["browser side"])
    end

    it "orders by last_seen_at descending so live breakage floats to the top" do
      older = record(message: "older")
      newer = record(message: "newer")
      older.update!(last_seen_at: 1.minute.from_now)

      get "/api/v1/admin/error_logs", headers: admin_auth_headers
      expect(json["error_logs"].map { |e| e["id"] }).to eq([older.id, newer.id])
    end

    it "omits the backtrace from the list but includes occurrence counts" do
      record

      get "/api/v1/admin/error_logs", headers: admin_auth_headers
      row = json["error_logs"].first
      expect(row).not_to have_key("backtrace")
      expect(row["occurrences_count"]).to eq(1)
      expect(row["first_seen_at"]).to be_present
      expect(row["last_seen_at"]).to be_present
    end
  end

  describe "GET /api/v1/admin/error_logs/:id" do
    it "includes the full backtrace" do
      error_log = record(stack: "app/models/thing.rb:12:in `explode'")

      get "/api/v1/admin/error_logs/#{error_log.id}", headers: admin_auth_headers
      expect(json.dig("error_log", "backtrace")).to include("explode")
    end
  end

  describe "POST /api/v1/admin/error_logs/:id/resolve" do
    it "marks resolved" do
      error_log = record

      post "/api/v1/admin/error_logs/#{error_log.id}/resolve", headers: admin_auth_headers
      expect(json.dig("error_log", "resolved")).to be(true)
      expect(error_log.reload.resolved?).to be(true)
    end
  end

  describe "POST /api/v1/admin/error_logs/:id/reopen" do
    it "reopens a resolved error" do
      error_log = record
      error_log.resolve!

      post "/api/v1/admin/error_logs/#{error_log.id}/reopen", headers: admin_auth_headers
      expect(error_log.reload.resolved?).to be(false)
    end
  end
end
