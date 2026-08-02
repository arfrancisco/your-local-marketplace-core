module Api
  module V1
    module Admin
      # Read-only — this is an audit log, entries are only ever created by
      # Orders::TransitionStatus, never edited/removed here.
      class OrderStatusEventsController < BaseController
        before_action :set_order_status_event, only: %i[show]

        # GET /api/v1/admin/order_status_events?order_id=1
        def index
          scope = OrderStatusEvent.order(created_at: :desc)
          scope = scope.where(order_id: params[:order_id]) if params[:order_id].present?
          render json: {
            order_status_events: paginate(scope).map { |e| ::Admin::OrderStatusEventSerializer.call(e) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { order_status_event: ::Admin::OrderStatusEventSerializer.call(@order_status_event) }
        end

        private

        def set_order_status_event
          @order_status_event = OrderStatusEvent.find(params[:id])
        end
      end
    end
  end
end
