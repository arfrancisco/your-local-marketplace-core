module Api
  module V1
    module Vendor
      # Private, vendor-only notes about customers.
      #
      # SECURITY: every action reaches notes through
      # `current_vendor_profile.vendor_customer_notes`. That scoping is the
      # entire privacy boundary for this feature — there is deliberately no
      # code path here that queries VendorCustomerNote unscoped. A vendor
      # asking for another vendor's note gets a 404 from the scoped `find`,
      # matching the ownership-scoped-lookup convention used by
      # ItemsController (a cross-tenant id is treated as nonexistent rather
      # than forbidden, so the endpoint never confirms the record exists).
      class CustomerNotesController < BaseController
        before_action :set_note, only: %i[update destroy]

        # GET /api/v1/vendor/customer_notes?customer_profile_id=:id (optional)
        def index
          notes = current_vendor_profile.vendor_customer_notes.order(created_at: :desc)
          notes = notes.where(customer_profile_id: params[:customer_profile_id]) if params[:customer_profile_id].present?
          render json: { customer_notes: notes.map { |note| VendorCustomerNoteSerializer.call(note) } }
        end

        # POST /api/v1/vendor/customer_notes
        def create
          order = owned_order
          note = current_vendor_profile.vendor_customer_notes.create!(
            customer_profile: order.customer_profile,
            order: order,
            note: params.require(:note),
            flagged: ActiveModel::Type::Boolean.new.cast(params[:flagged]) || false
          )
          render json: { customer_note: VendorCustomerNoteSerializer.call(note) }, status: :created
        end

        # PATCH /api/v1/vendor/customer_notes/:id
        def update
          @note.update!(note_params)
          render json: { customer_note: VendorCustomerNoteSerializer.call(@note) }
        end

        # DELETE /api/v1/vendor/customer_notes/:id
        def destroy
          @note.destroy!
          head :no_content
        end

        private

        def set_note
          @note = current_vendor_profile.vendor_customer_notes.find(params[:id])
        end

        # The order establishes *which* customer is being noted about, so it
        # has to be one of this vendor's own orders. Scoped through
        # vendor_profiles.user_id the same way ItemsController#set_item does.
        def owned_order
          Order.joins(shop: :vendor_profile)
               .where(vendor_profiles: { user_id: current_user.id })
               .find(params.require(:order_id))
        end

        def note_params
          params.permit(:note, :flagged)
        end
      end
    end
  end
end
