module Api
  module V1
    module Admin
      class CustomerProfilesController < BaseController
        before_action :set_customer_profile, only: %i[show]

        # GET /api/v1/admin/customer_profiles
        def index
          scope = CustomerProfile.order(created_at: :desc)
          render json: {
            customer_profiles: paginate(scope).map { |cp| Admin::CustomerProfileSerializer.call(cp) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { customer_profile: Admin::CustomerProfileSerializer.call(@customer_profile) }
        end

        private

        def set_customer_profile
          @customer_profile = CustomerProfile.find(params[:id])
        end
      end
    end
  end
end
