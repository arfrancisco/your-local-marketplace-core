require "rails_helper"

RSpec.describe "Api::V1 Feedback", type: :request do
  describe "POST /api/v1/feedback" do
    it "accepts feedback from an anonymous visitor" do
      expect {
        post "/api/v1/feedback", params: { message: "Checkout button felt slow", email: "neighbor@example.com" }
      }.to change(FeedbackSubmission, :count).by(1)

      expect(response).to have_http_status(:created)
      submission = FeedbackSubmission.last
      expect(submission.user).to be_nil
      expect(submission.email).to eq("neighbor@example.com")
    end

    it "attributes the submission to a signed-in user and falls back to their email" do
      customer = create(:user, :customer)
      post "/api/v1/feedback", params: { message: "Love the new inventory page" }, headers: auth_headers(customer)

      expect(response).to have_http_status(:created)
      submission = FeedbackSubmission.last
      expect(submission.user).to eq(customer)
      expect(submission.email).to eq(customer.email)
    end

    it "enqueues a best-effort notification job" do
      expect {
        post "/api/v1/feedback", params: { message: "Something's off with the map" }
      }.to have_enqueued_job(FeedbackNotificationJob)
    end

    it "rejects a blank message" do
      post "/api/v1/feedback", params: { message: "" }
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json.dig("error", "code")).to eq("validation_failed")
    end
  end
end
