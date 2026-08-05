module Api
  module V1
    module Admin
      class VendorProfilesController < BaseController
        before_action :set_vendor_profile, only: %i[show approve reject clear_cancellation_restriction]

        # GET /api/v1/admin/vendor_profiles?verification_status=pending&demo=true
        def index
          scope = filter_by_demo(VendorProfile.order(created_at: :desc))
          if params[:verification_status].present?
            scope = scope.where(verification_status: params[:verification_status])
          end
          render json: {
            vendor_profiles: paginate(scope).map { |vp| ::Admin::VendorProfileSerializer.call(vp) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { vendor_profile: ::Admin::VendorProfileSerializer.call(@vendor_profile) }
        end

        # POST /api/v1/admin/vendor_profiles/:id/approve
        def approve
          @vendor_profile.update!(verification_status: "verified")
          render json: { vendor_profile: ::Admin::VendorProfileSerializer.call(@vendor_profile) }
        end

        # POST /api/v1/admin/vendor_profiles/:id/reject
        def reject
          @vendor_profile.update!(verification_status: "rejected")
          render json: { vendor_profile: ::Admin::VendorProfileSerializer.call(@vendor_profile) }
        end

        # POST /api/v1/admin/vendor_profiles/:id/clear_cancellation_restriction
        # Only clears the tier-1 timestamp — cancellation_restriction_count is
        # permanent and is never touched here (it's what distinguishes a first
        # offense from a second, even after this clears). Does NOT reopen the
        # vendor's shop(s); that stays a separate action the vendor takes
        # themselves once able to.
        def clear_cancellation_restriction
          @vendor_profile.update!(cancellation_restricted_at: nil)
          render json: { vendor_profile: ::Admin::VendorProfileSerializer.call(@vendor_profile) }
        end

        private

        def set_vendor_profile
          @vendor_profile = VendorProfile.find(params[:id])
        end
      end
    end
  end
end
