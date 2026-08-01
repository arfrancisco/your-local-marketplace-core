module Api
  module V1
    # Exists only for the checked-in e2e suite to retrieve a real verification
    # code deterministically, without a real phone or inbox — see
    # config/initializers/test_helpers.rb for why this can never reach
    # production (route isn't even drawn there, see routes.rb).
    class TestHelpersController < BaseController
      skip_before_action :authenticate!, only: :verification_code

      # GET /api/v1/test_helpers/verification_code?email=...&purpose=...
      def verification_code
        return head(:not_found) unless TestHelperAccess.enabled?
        return head(:not_found) unless VerificationChallenge::PURPOSES.include?(params[:purpose].to_s)

        user = User.find_by("lower(email) = ?", params[:email].to_s.strip.downcase)
        return head(:not_found) if user.nil?

        code = Sidekiq.redis { |conn| conn.get(VerificationChallenge.test_cache_key(user_id: user.id, purpose: params[:purpose])) }
        return head(:not_found) if code.nil?

        render json: { code: code }
      end
    end
  end
end
