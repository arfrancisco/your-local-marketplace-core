module Admin
  module FeedbackSubmissionSerializer
    module_function

    def call(feedback_submission)
      {
        id: feedback_submission.id,
        user_id: feedback_submission.user_id,
        email: feedback_submission.email,
        message: feedback_submission.message,
        page_url: feedback_submission.page_url,
        resolved: feedback_submission.resolved?,
        resolved_at: feedback_submission.resolved_at,
        created_at: feedback_submission.created_at
      }
    end
  end
end
