module Api
  module V1
    module Admin
      class CustomerProfilesController < BaseController
        before_action :set_customer_profile, only: %i[show verify_residency reject_residency clear_cancellation_restriction]

        # GET /api/v1/admin/customer_profiles?demo=true&residency_verification_status=pending
        def index
          scope = filter_by_demo(CustomerProfile.order(created_at: :desc))
          if params[:residency_verification_status].present?
            scope = scope.where(residency_verification_status: params[:residency_verification_status])
          end
          render json: {
            customer_profiles: paginate(scope).map { |cp| ::Admin::CustomerProfileSerializer.call(cp) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { customer_profile: ::Admin::CustomerProfileSerializer.call(@customer_profile) }
        end

        # POST /api/v1/admin/customer_profiles/:id/verify_residency
        def verify_residency
          @customer_profile.update!(residency_verification_status: "verified")
          render json: { customer_profile: ::Admin::CustomerProfileSerializer.call(@customer_profile) }
        end

        # POST /api/v1/admin/customer_profiles/:id/reject_residency
        def reject_residency
          @customer_profile.update!(residency_verification_status: "rejected")
          render json: { customer_profile: ::Admin::CustomerProfileSerializer.call(@customer_profile) }
        end

        # POST /api/v1/admin/customer_profiles/:id/clear_cancellation_restriction
        # Only clears the tier-1 timestamp — cancellation_restriction_count is
        # permanent and is never touched here (it's what distinguishes a first
        # offense from a second, even after this clears).
        def clear_cancellation_restriction
          @customer_profile.update!(cancellation_restricted_at: nil)
          render json: { customer_profile: ::Admin::CustomerProfileSerializer.call(@customer_profile) }
        end

        private

        def set_customer_profile
          @customer_profile = CustomerProfile.find(params[:id])
        end
      end
    end
  end
end
