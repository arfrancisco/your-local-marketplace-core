require "rails_helper"

RSpec.describe "Api::V1::Admin::FeedbackSubmissions", type: :request do
  let(:feedback_submission) { FeedbackSubmission.create!(message: "Checkout felt slow") }

  describe "GET /api/v1/admin/feedback_submissions" do
    let(:request_method) { :get }
    let(:request_path) { "/api/v1/admin/feedback_submissions" }

    it_behaves_like "requires admin auth"

    it "filters by resolved" do
      feedback_submission.resolve!
      FeedbackSubmission.create!(message: "Still unresolved")

      get "/api/v1/admin/feedback_submissions", params: { resolved: "false" }, headers: admin_auth_headers
      expect(json["feedback_submissions"].map { |f| f["message"] }).to eq(["Still unresolved"])
    end
  end

  describe "POST /api/v1/admin/feedback_submissions/:id/resolve" do
    it "marks resolved" do
      post "/api/v1/admin/feedback_submissions/#{feedback_submission.id}/resolve", headers: admin_auth_headers
      expect(json.dig("feedback_submission", "resolved")).to be(true)
      expect(feedback_submission.reload.resolved?).to be(true)
    end
  end

  describe "POST /api/v1/admin/feedback_submissions/:id/reopen" do
    it "reopens a resolved submission" do
      feedback_submission.resolve!
      post "/api/v1/admin/feedback_submissions/#{feedback_submission.id}/reopen", headers: admin_auth_headers
      expect(feedback_submission.reload.resolved?).to be(false)
    end
  end
end
