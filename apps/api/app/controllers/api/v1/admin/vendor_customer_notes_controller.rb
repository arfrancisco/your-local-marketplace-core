module Api
  module V1
    module Admin
      # Read-only, cross-vendor visibility into private vendor notes about
      # customers — the one exception to those notes' vendor-only privacy,
      # since this is exactly the evidence an operator needs when
      # investigating a dispute (e.g. confirming whether multiple vendors
      # have independently flagged the same customer_profile_id). No
      # create/update/destroy here — only the writing vendor can do that,
      # via Api::V1::Vendor::CustomerNotesController.
      class VendorCustomerNotesController < BaseController
        before_action :set_note, only: %i[show]

        # GET /api/v1/admin/vendor_customer_notes?vendor_profile_id=1&customer_profile_id=2
        def index
          scope = VendorCustomerNote.order(created_at: :desc)
          scope = scope.where(vendor_profile_id: params[:vendor_profile_id]) if params[:vendor_profile_id].present?
          scope = scope.where(customer_profile_id: params[:customer_profile_id]) if params[:customer_profile_id].present?
          render json: {
            vendor_customer_notes: paginate(scope).map { |n| Admin::VendorCustomerNoteSerializer.call(n) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { vendor_customer_note: Admin::VendorCustomerNoteSerializer.call(@note) }
        end

        private

        def set_note
          @note = VendorCustomerNote.find(params[:id])
        end
      end
    end
  end
end
