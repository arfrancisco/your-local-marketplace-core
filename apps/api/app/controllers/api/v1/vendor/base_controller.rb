module Api
  module V1
    module Vendor
      # Shared base for all /vendor endpoints: requires authentication (from
      # Api::V1::BaseController) plus a vendor profile on the current user.
      class BaseController < Api::V1::BaseController
        before_action :require_vendor_profile

        private

        def current_vendor_profile
          @current_vendor_profile ||= current_user.vendor_profile
        end

        def require_vendor_profile
          raise ApiError::Forbidden, "A vendor profile is required for this action" if current_vendor_profile.nil?
        end
      end
    end
  end
end
