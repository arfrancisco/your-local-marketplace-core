module Api
  module V1
    module Admin
      # Read-only/audit — never mutate a code's consumed/expired state.
      class VerificationChallengesController < BaseController
        before_action :set_verification_challenge, only: %i[show]

        # GET /api/v1/admin/verification_challenges?user_id=1&purpose=mobile_verification
        def index
          scope = VerificationChallenge.order(created_at: :desc)
          scope = scope.where(user_id: params[:user_id]) if params[:user_id].present?
          scope = scope.where(purpose: params[:purpose]) if params[:purpose].present?
          render json: {
            verification_challenges: paginate(scope).map { |c| ::Admin::VerificationChallengeSerializer.call(c) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { verification_challenge: ::Admin::VerificationChallengeSerializer.call(@verification_challenge) }
        end

        private

        def set_verification_challenge
          @verification_challenge = VerificationChallenge.find(params[:id])
        end
      end
    end
  end
end
