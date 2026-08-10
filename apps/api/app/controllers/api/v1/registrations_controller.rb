module Api
  module V1
    class RegistrationsController < BaseController
      skip_before_action :authenticate!, only: :create

      # POST /api/v1/auth/register
      def create
        # Honeypot (see LoginPage.tsx): real users never see or fill this
        # field. Read directly off params, not through registration_params'
        # allowlist, so it can never accidentally reach Auth::RegisterUser
        # even if this check is ever removed. Bails out before any DB write
        # or Semaphore/Resend call -- the whole point is to not pay for or
        # otherwise process a bot's submission.
        if params.dig(:user, :website).present?
          alert_honeypot_triggered!
          raise ApiError::UnprocessableEntity, "Registration failed"
        end

        result = Auth::RegisterUser.new(
          email: registration_params[:email],
          password: registration_params[:password],
          mobile_number: registration_params[:mobile_number],
          display_name: registration_params[:display_name],
          roles: registration_params[:roles],
          is_resident: registration_params[:is_resident],
          willing_to_verify_residency: registration_params[:willing_to_verify_residency],
          terms_accepted: registration_params[:terms_accepted],
          email_marketing_opt_in: registration_params[:email_marketing_opt_in],
          sms_marketing_opt_in: registration_params[:sms_marketing_opt_in]
        ).call

        render json: { token: result.token, user: UserSerializer.call(result.user) }, status: :created
      end

      private

      def registration_params
        params.require(:user).permit(
          :email, :password, :mobile_number, :display_name,
          :is_resident, :willing_to_verify_residency, :terms_accepted,
          :email_marketing_opt_in, :sms_marketing_opt_in, roles: []
        )
      end

      # Not a real raised exception -- constructed and handed to
      # ErrorLog.record! purely to get the same fingerprint/dedup/first-
      # occurrence-alert behavior real exceptions get. A stable message keeps
      # every hit collapsing onto one fingerprint (occurrences_count climbs
      # instead of a fresh alert per submission), and a real human should
      # essentially never trigger this at all, so even one occurrence during
      # beta is worth knowing about.
      class HoneypotTriggered < StandardError; end

      def alert_honeypot_triggered!
        exception = HoneypotTriggered.new("Registration honeypot field was filled")
        exception.set_backtrace(caller)
        log, newly_created = ErrorLog.record!(source: "backend", exception: exception, request: request)
        ErrorAlertJob.perform_later(log.id) if newly_created
      end
    end
  end
end
