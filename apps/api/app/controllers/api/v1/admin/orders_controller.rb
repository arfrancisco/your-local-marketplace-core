module Api
  module V1
    module Admin
      class OrdersController < BaseController
        before_action :set_order, only: %i[show transition]

        # GET /api/v1/admin/orders?status=placed&shop_id=1&demo=true
        def index
          scope = filter_by_demo(Order.order(placed_at: :desc))
          scope = scope.where(status: params[:status]) if params[:status].present?
          scope = scope.where(shop_id: params[:shop_id]) if params[:shop_id].present?
          render json: {
            orders: paginate(scope).map { |o| OrderSerializer.call(o).merge(demo: o.demo?) },
            meta: pagination_meta(scope)
          }
        end

        def show
          render json: { order: OrderSerializer.call(@order).merge(demo: @order.demo?) }
        end

        # POST /api/v1/admin/orders/:id/transitions (to_status, reason)
        #
        # Bypasses the normal actor restriction (customer may only cancel,
        # everything else is vendor-only — see Api::V1::OrdersController) for
        # an operator unsticking a stuck order. The legal-transition state
        # machine itself (Order#can_transition_to?, enforced inside
        # Orders::TransitionStatus) still applies — this does not let an
        # order skip states. Attributed to the shop's own vendor user (not a
        # nil actor) since OrderStatusEvent#actor_user is a required
        # association; the "[admin override]" prefix on the reason makes
        # these searchable in the audit trail.
        def transition
          to_status = params.require(:to_status)
          order = Orders::TransitionStatus.new(
            order: @order,
            to_status: to_status,
            actor_user: @order.shop.vendor_profile.user,
            reason: "[admin override] #{params[:reason]}"
          ).call
          render json: { order: OrderSerializer.call(order) }
        end

        private

        def set_order
          @order = Order.find(params[:id])
        end
      end
    end
  end
end
