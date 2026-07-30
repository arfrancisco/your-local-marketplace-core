module Api
  module V1
    # Public early-access lead capture for the demand-test demo. No auth, no
    # account created — just interest. A repeat submission from the same email or
    # phone is treated as success ("you're already on the list") rather than a
    # duplicate error, so the CTA never feels broken.
    class EarlyAccessController < BaseController
      skip_before_action :authenticate!

      # POST /api/v1/early_access
      def create
        existing = EarlyAccessSignup.for_contact(
          email: signup_params[:email], mobile_number: signup_params[:mobile_number]
        )
        if existing
          return render json: { status: "already_registered" }, status: :ok
        end

        EarlyAccessSignup.create!(signup_params)
        render json: { status: "registered" }, status: :created
      end

      private

      def signup_params
        params.require(:early_access_signup).permit(:email, :mobile_number, :name, :interest, :context)
      end
    end
  end
end
