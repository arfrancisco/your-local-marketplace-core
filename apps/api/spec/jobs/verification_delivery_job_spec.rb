require "rails_helper"

# Covers the fix for a real gap found during an infra review: the job
# deliberately never raises on a provider failure (an OTP send shouldn't hit
# Sidekiq's retry storm — the user can just tap "resend"), but that used to
# mean provider failures were also invisible to error_logs, since raising is
# the only thing that reaches ApplicationJob's rescue_from. See
# apps/api/app/jobs/verification_delivery_job.rb#perform_request.
RSpec.describe VerificationDeliveryJob do
  let(:user) { create(:user) }

  before do
    @original_env = ENV.to_hash
    ENV["RESEND_API_KEY"] = "test-resend-key"
    ENV["EMAIL_FROM_ADDRESS"] = "no-reply@kapitmarket.ph"
    ENV["SEMAPHORE_API_KEY"] = "test-semaphore-key"
  end

  after do
    ENV.replace(@original_env)
  end

  def issue_email_challenge
    challenge, code = VerificationChallenge.issue!(
      user: user, channel: "email", purpose: "email_verification", sent_to: user.email
    )
    [challenge, code]
  end

  it "does nothing and makes no HTTP call when the challenge is already consumed" do
    challenge, code = issue_email_challenge
    challenge.update!(consumed_at: Time.current)

    expect(Net::HTTP).not_to receive(:start)
    described_class.perform_now(challenge.id, code)
  end

  it "makes no request and records nothing when the challenge no longer exists" do
    expect(Net::HTTP).not_to receive(:start)
    expect { described_class.perform_now(-1, "123456") }.not_to change(ErrorLog, :count)
  end

  it "does not record an error log on a successful provider response" do
    challenge, code = issue_email_challenge
    success = instance_double(Net::HTTPOK, is_a?: true)
    allow(Net::HTTP).to receive(:start).and_return(success)

    expect { described_class.perform_now(challenge.id, code) }.not_to change(ErrorLog, :count)
  end

  it "records an error log (and alerts once) when the provider returns a non-success response" do
    challenge, code = issue_email_challenge
    failure = instance_double(Net::HTTPBadRequest, is_a?: false, code: "400", body: "bad request")
    allow(Net::HTTP).to receive(:start).and_return(failure)

    expect {
      described_class.perform_now(challenge.id, code)
    }.to change(ErrorLog, :count).by(1).and have_enqueued_job(ErrorAlertJob)

    expect(ErrorLog.last).to have_attributes(source: "backend", exception_class: "RuntimeError")
  end

  it "records an error log (and alerts once) and still does not raise when the HTTP call itself raises" do
    challenge, code = issue_email_challenge
    allow(Net::HTTP).to receive(:start).and_raise(Net::OpenTimeout, "execution expired")

    expect {
      expect { described_class.perform_now(challenge.id, code) }.not_to raise_error
    }.to change(ErrorLog, :count).by(1).and have_enqueued_job(ErrorAlertJob)

    expect(ErrorLog.last).to have_attributes(source: "backend", exception_class: "Net::OpenTimeout")
  end

  it "only alerts on the first occurrence of a repeating failure, same as ApplicationJob's own hook" do
    challenge1, code1 = issue_email_challenge
    challenge2, code2 = issue_email_challenge
    allow(Net::HTTP).to receive(:start).and_raise(Net::OpenTimeout, "execution expired")

    expect { described_class.perform_now(challenge1.id, code1) }.to have_enqueued_job(ErrorAlertJob)
    expect { described_class.perform_now(challenge2.id, code2) }.not_to have_enqueued_job(ErrorAlertJob)
    expect(ErrorLog.last.occurrences_count).to eq(2)
  end
end
