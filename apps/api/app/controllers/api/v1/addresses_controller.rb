module Api
  module V1
    # The current user's saved addresses (descriptive, not geographic — ADR 0002).
    # Scoped to the authenticated user so one user can never see or touch
    # another's addresses. Used later for delivery orders (M3).
    class AddressesController < BaseController
      before_action :set_address, only: %i[update destroy]

      # GET /api/v1/addresses
      def index
        addresses = current_user.addresses.order(created_at: :desc)
        render json: { addresses: addresses.map { |a| AddressSerializer.call(a) } }
      end

      # POST /api/v1/addresses
      def create
        address = current_user.addresses.create!(address_params)
        render json: { address: AddressSerializer.call(address) }, status: :created
      end

      # PATCH /api/v1/addresses/:id
      def update
        @address.update!(address_params)
        render json: { address: AddressSerializer.call(@address) }
      end

      # DELETE /api/v1/addresses/:id
      def destroy
        @address.destroy!
        head :no_content
      end

      private

      def set_address
        @address = current_user.addresses.find(params[:id])
      end

      def address_params
        params.require(:address).permit(
          :label, :recipient_name, :mobile_number, :unit, :building,
          :street_address, :city, :notes, :delivery_instructions
        )
      end
    end
  end
end
