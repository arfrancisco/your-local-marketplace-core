module Api
  module V1
    module Admin
      class FeedbackSubmissionsController < BaseController
        before_action :set_feedback_submission, only: %i[show resolve reopen]

        # GET /api/v1/admin/feedback_submissions?resolved=false
        def index
          scope = FeedbackSubmission.order(created_at: :desc)
          if params[:resolved] == "false"
            scope = scope.unresolved
          elsif params[:resolved] == "true"
            scope = scope.where.not(resolved_at: nil)
          end
          render json: {
            feedback_submissions: paginate(scope).map { |f| ::Admin::FeedbackSubmissionSerializer.call(f) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { feedback_submission: ::Admin::FeedbackSubmissionSerializer.call(@feedback_submission) }
        end

        # POST /api/v1/admin/feedback_submissions/:id/resolve
        def resolve
          @feedback_submission.resolve!
          render json: { feedback_submission: ::Admin::FeedbackSubmissionSerializer.call(@feedback_submission) }
        end

        # POST /api/v1/admin/feedback_submissions/:id/reopen
        def reopen
          @feedback_submission.reopen!
          render json: { feedback_submission: ::Admin::FeedbackSubmissionSerializer.call(@feedback_submission) }
        end

        private

        def set_feedback_submission
          @feedback_submission = FeedbackSubmission.find(params[:id])
        end
      end
    end
  end
end
