require "rails_helper"

RSpec.describe ErrorLog do
  # Builds a real raised exception so `backtrace` is populated the way it would
  # be in production — a hand-made exception has a nil backtrace, which would
  # quietly make the fingerprint tests less meaningful.
  def raised(klass = ArgumentError, message = "boom")
    raise klass, message
  rescue StandardError => e
    e
  end

  def raised_no_method_error
    nil.no_such_method
  rescue StandardError => e
    e
  end

  describe ".record!" do
    it "creates a row on first occurrence and reports it as newly created" do
      log, newly_created = nil

      expect {
        log, newly_created = described_class.record!(source: "backend", exception: raised)
      }.to change(described_class, :count).by(1)

      expect(newly_created).to be(true)
      expect(log.source).to eq("backend")
      expect(log.exception_class).to eq("ArgumentError")
      expect(log.message).to eq("boom")
      expect(log.backtrace).to be_present
      expect(log.occurrences_count).to eq(1)
      expect(log.first_seen_at).to be_present
      expect(log.last_seen_at).to be_present
    end

    it "dedupes a repeat of the same error into one row and increments the count" do
      first, = described_class.record!(source: "backend", exception: raised)

      expect {
        @second, @newly_created = described_class.record!(source: "backend", exception: raised)
      }.not_to change(described_class, :count)

      expect(@newly_created).to be(false)
      expect(@second.id).to eq(first.id)
      expect(@second.occurrences_count).to eq(2)
    end

    it "moves last_seen_at forward on a repeat but leaves first_seen_at alone" do
      log, = described_class.record!(source: "backend", exception: raised)
      original_first_seen = log.first_seen_at
      original_last_seen = log.last_seen_at

      travel_to(1.hour.from_now) do
        described_class.record!(source: "backend", exception: raised)
      end

      log.reload
      expect(log.first_seen_at).to be_within(1.second).of(original_first_seen)
      expect(log.last_seen_at).to be > original_last_seen
    end

    it "keeps genuinely different errors in separate rows" do
      described_class.record!(source: "backend", exception: raised(ArgumentError, "boom"))
      described_class.record!(source: "backend", exception: raised(RuntimeError, "boom"))
      described_class.record!(source: "backend", exception: raised(ArgumentError, "different message"))

      expect(described_class.count).to eq(3)
    end

    it "attributes the request path/method and user when given them" do
      user = create(:user, :customer)
      request = instance_double(ActionDispatch::Request, path: "/api/v1/shops", request_method: "GET")

      log, = described_class.record!(source: "backend", exception: raised, request: request, user: user)

      expect(log.request_path).to eq("/api/v1/shops")
      expect(log.request_method).to eq("GET")
      expect(log.user_id).to eq(user.id)
    end

    it "records a NoMethodError under its class, not the missing method name" do
      # NameError/NoMethodError define their own #name (here, :no_such_method),
      # so duck-typing on respond_to?(:name) would mislabel the most common
      # class of real bug. Regression guard.
      log, = described_class.record!(source: "backend", exception: raised_no_method_error)
      expect(log.exception_class).to eq("NoMethodError")
    end

    it "records a browser-reported ClientError under its reported name" do
      client_error = described_class::ClientError.new(
        name: "TypeError", message: "undefined is not a function", backtrace: "at Foo (app.js:1:1)"
      )

      log, newly_created = described_class.record!(source: "customer-web", exception: client_error)

      expect(newly_created).to be(true)
      expect(log.source).to eq("customer-web")
      expect(log.exception_class).to eq("TypeError")
      expect(log.backtrace).to include("app.js")
    end

    it "falls back to placeholders rather than failing validation on an empty report" do
      client_error = described_class::ClientError.new(name: nil, message: "")

      log, = described_class.record!(source: "customer-web", exception: client_error)

      expect(log.exception_class).to eq("ClientError")
      expect(log.message).to eq("(no message)")
    end
  end

  describe "resolve!/reopen!" do
    let(:error_log) { described_class.record!(source: "backend", exception: raised).first }

    it "resolves and reopens" do
      expect(error_log.resolved?).to be(false)

      error_log.resolve!
      expect(error_log.resolved?).to be(true)
      expect(described_class.unresolved).not_to include(error_log)

      error_log.reopen!
      expect(error_log.resolved?).to be(false)
      expect(described_class.unresolved).to include(error_log)
    end
  end
end
