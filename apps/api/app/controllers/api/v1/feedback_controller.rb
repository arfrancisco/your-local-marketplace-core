module Api
  module V1
    # Public feedback/complaints intake for the beta. Works for signed-in and
    # anonymous callers alike — browsing itself is public, so feedback should
    # be too. When a bearer token is present, the submission is attributed to
    # that user; otherwise the caller may leave an optional email to be
    # reachable at.
    class FeedbackController < BaseController
      skip_before_action :authenticate!
      before_action :authenticate_optionally!

      # POST /api/v1/feedback (message, email, page_url)
      def create
        submission = FeedbackSubmission.create!(
          user: current_user,
          email: feedback_params[:email].presence || current_user&.email,
          message: feedback_params[:message],
          page_url: feedback_params[:page_url]
        )
        FeedbackNotificationJob.perform_later(submission.id)
        render json: { status: "received" }, status: :created
      end

      private

      def feedback_params
        params.permit(:message, :email, :page_url)
      end
    end
  end
end
