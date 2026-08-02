module Api
  module V1
    module Admin
      class AddressesController < BaseController
        before_action :set_address, only: %i[show]

        # GET /api/v1/admin/addresses?user_id=1
        def index
          scope = Address.order(created_at: :desc)
          scope = scope.where(user_id: params[:user_id]) if params[:user_id].present?
          render json: { addresses: paginate(scope).map { |a| AddressSerializer.call(a) }, meta: pagination_meta(scope) }
        end

        def show
          render json: { address: AddressSerializer.call(@address) }
        end

        private

        def set_address
          @address = Address.find(params[:id])
        end
      end
    end
  end
end
