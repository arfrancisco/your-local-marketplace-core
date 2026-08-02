module Api
  module V1
    module Admin
      class VendorProfilesController < BaseController
        before_action :set_vendor_profile, only: %i[show approve reject]

        # GET /api/v1/admin/vendor_profiles?verification_status=pending
        def index
          scope = VendorProfile.order(created_at: :desc)
          if params[:verification_status].present?
            scope = scope.where(verification_status: params[:verification_status])
          end
          render json: {
            vendor_profiles: paginate(scope).map { |vp| Admin::VendorProfileSerializer.call(vp) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { vendor_profile: Admin::VendorProfileSerializer.call(@vendor_profile) }
        end

        # POST /api/v1/admin/vendor_profiles/:id/approve
        def approve
          @vendor_profile.update!(verification_status: "verified")
          render json: { vendor_profile: Admin::VendorProfileSerializer.call(@vendor_profile) }
        end

        # POST /api/v1/admin/vendor_profiles/:id/reject
        def reject
          @vendor_profile.update!(verification_status: "rejected")
          render json: { vendor_profile: Admin::VendorProfileSerializer.call(@vendor_profile) }
        end

        private

        def set_vendor_profile
          @vendor_profile = VendorProfile.find(params[:id])
        end
      end
    end
  end
end
