require "rails_helper"

# Covers the rescue_from hook added to ApplicationJob: a raising job must land
# in error_logs the same way a raising controller action does (see
# spec/requests/api/v1/internal_errors_spec.rb), but — unlike the controller
# case — must still propagate the exception so ActiveJob/Sidekiq's own
# retry/dead-set handling is unaffected. None of the three real jobs
# (VerificationDeliveryJob, ErrorAlertJob, FeedbackNotificationJob) naturally
# raise through to this hook in a test (they all rescue their own provider
# HTTP calls internally), so this uses a minimal job defined just for the spec.
class RaisingTestJob < ApplicationJob
  def perform
    raise ArgumentError, "boom from job"
  end
end

RSpec.describe ApplicationJob do
  def perform_and_swallow
    RaisingTestJob.perform_now
  rescue ArgumentError
    nil
  end

  it "records the failure in error_logs" do
    expect { perform_and_swallow }.to change(ErrorLog, :count).by(1)

    log = ErrorLog.last
    expect(log.source).to eq("backend")
    expect(log.exception_class).to eq("ArgumentError")
    expect(log.message).to eq("boom from job")
  end

  it "still re-raises instead of silently swallowing the exception" do
    expect { RaisingTestJob.perform_now }.to raise_error(ArgumentError, "boom from job")
  end

  it "still marks the ActiveJob execution as failed (does not get treated as a success)" do
    # perform_enqueued_jobs re-raises through Minitest's own wrapper, but the
    # original ArgumentError is still there as the cause — this is the same
    # "did the job actually fail" signal Sidekiq's retry/dead-set machinery
    # relies on outside of tests.
    expect {
      perform_enqueued_jobs { RaisingTestJob.perform_later }
    }.to raise_error { |error| expect(error.cause).to be_a(ArgumentError).and have_attributes(message: "boom from job") }
  end

  it "alerts on the first occurrence only, and counts the repeat" do
    expect { perform_and_swallow }.to have_enqueued_job(ErrorAlertJob)

    expect { perform_and_swallow }.not_to have_enqueued_job(ErrorAlertJob)
    expect(ErrorLog.last.occurrences_count).to eq(2)
  end
end
