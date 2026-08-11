require "rails_helper"

# Shared transport for both the live OTP path (VerificationDeliveryJob) and
# the new order-notification path (OrderNotificationJob). Mirrors the mocking
# pattern in verification_delivery_job_spec.rb (stub Net::HTTP.start rather
# than hitting a real endpoint), plus coverage that OTP and order-notification
# failures land under distinct ErrorLog fingerprints (see the `purpose` tag
# baked into the exception message in Semaphore::Client#perform_request).
RSpec.describe Semaphore::Client do
  before do
    @original_env = ENV.to_hash
    ENV["SEMAPHORE_API_KEY"] = "test-semaphore-key"
    ENV.delete("SEMAPHORE_SENDER_NAME")
  end

  after do
    ENV.replace(@original_env)
  end

  describe ".send_otp" do
    it "does nothing and makes no HTTP call when SEMAPHORE_API_KEY is blank" do
      ENV.delete("SEMAPHORE_API_KEY")
      expect(Net::HTTP).not_to receive(:start)
      described_class.send_otp(number: "+639171234567", code: "123456", message: "code is {otp}")
    end

    it "does not record an error log on a successful provider response" do
      success = instance_double(Net::HTTPOK, is_a?: true)
      allow(Net::HTTP).to receive(:start).and_return(success)

      expect {
        described_class.send_otp(number: "+639171234567", code: "123456", message: "code is {otp}")
      }.not_to change(ErrorLog, :count)
    end

    it "records an error log tagged with the otp purpose (and alerts once) on a non-success response" do
      failure = instance_double(Net::HTTPBadRequest, is_a?: false, code: "400", body: "bad request")
      allow(Net::HTTP).to receive(:start).and_return(failure)

      expect {
        described_class.send_otp(number: "+639171234567", code: "123456", message: "code is {otp}")
      }.to change(ErrorLog, :count).by(1).and have_enqueued_job(ErrorAlertJob)

      expect(ErrorLog.last).to have_attributes(source: "backend", exception_class: "RuntimeError")
      expect(ErrorLog.last.message).to include("(otp)")
    end

    it "records an error log tagged with the otp purpose and does not raise when the HTTP call itself raises" do
      allow(Net::HTTP).to receive(:start).and_raise(Net::OpenTimeout, "execution expired")

      expect {
        expect {
          described_class.send_otp(number: "+639171234567", code: "123456", message: "code is {otp}")
        }.not_to raise_error
      }.to change(ErrorLog, :count).by(1).and have_enqueued_job(ErrorAlertJob)

      expect(ErrorLog.last).to have_attributes(source: "backend", exception_class: "Net::OpenTimeout")
      expect(ErrorLog.last.message).to include("(otp)")
    end
  end

  describe ".send_message" do
    it "does nothing and makes no HTTP call when SEMAPHORE_API_KEY is blank" do
      ENV.delete("SEMAPHORE_API_KEY")
      expect(Net::HTTP).not_to receive(:start)
      described_class.send_message(number: "+639171234567", text: "hello")
    end

    it "does not record an error log on a successful provider response" do
      success = instance_double(Net::HTTPOK, is_a?: true)
      allow(Net::HTTP).to receive(:start).and_return(success)

      expect {
        described_class.send_message(number: "+639171234567", text: "hello")
      }.not_to change(ErrorLog, :count)
    end

    it "records an error log tagged with the order_notification purpose (and alerts once) on a non-success response" do
      failure = instance_double(Net::HTTPBadRequest, is_a?: false, code: "400", body: "bad request")
      allow(Net::HTTP).to receive(:start).and_return(failure)

      expect {
        described_class.send_message(number: "+639171234567", text: "hello")
      }.to change(ErrorLog, :count).by(1).and have_enqueued_job(ErrorAlertJob)

      expect(ErrorLog.last).to have_attributes(source: "backend", exception_class: "RuntimeError")
      expect(ErrorLog.last.message).to include("(order_notification)")
    end

    it "records an error log tagged with the order_notification purpose and does not raise when the HTTP call itself raises" do
      allow(Net::HTTP).to receive(:start).and_raise(Net::OpenTimeout, "execution expired")

      expect {
        expect {
          described_class.send_message(number: "+639171234567", text: "hello")
        }.not_to raise_error
      }.to change(ErrorLog, :count).by(1).and have_enqueued_job(ErrorAlertJob)

      expect(ErrorLog.last).to have_attributes(source: "backend", exception_class: "Net::OpenTimeout")
      expect(ErrorLog.last.message).to include("(order_notification)")
    end

    it "gives an otp failure and an order_notification failure distinct fingerprints even with the same underlying exception" do
      allow(Net::HTTP).to receive(:start).and_raise(Net::OpenTimeout, "execution expired")

      expect {
        described_class.send_otp(number: "+639171234567", code: "123456", message: "code is {otp}")
        described_class.send_message(number: "+639171234567", text: "hello")
      }.to change(ErrorLog, :count).by(2)

      fingerprints = ErrorLog.pluck(:fingerprint)
      expect(fingerprints.uniq.size).to eq(2)
    end
  end
end
