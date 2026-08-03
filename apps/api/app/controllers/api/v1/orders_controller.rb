module Api
  module V1
    # Order detail/transition actions are shared between customer and vendor
    # (OrderPolicy unifies ownership for both sides) — see config/routes.rb
    # for why this isn't split into a vendor namespace like Shop/Item are.
    class OrdersController < BaseController
      before_action :set_order, only: %i[show transition mark_paid update_items]

      # GET /api/v1/orders — the current customer's own orders
      def index
        raise ApiError::Forbidden, "A customer profile is required for this action" if current_user.customer_profile.nil?

        orders = current_user.customer_profile.orders.order(placed_at: :desc)
        render json: { orders: orders.map { |order| OrderSerializer.call(order) } }
      end

      # GET /api/v1/orders/:id
      def show
        render json: { order: OrderSerializer.call(@order) }
      end

      # POST /api/v1/orders/:id/transitions (to_status, reason, reason_code)
      # Status changes are explicit button-driven actions only (ADR 0009) —
      # never inferred from chat. A customer may only request "cancelled";
      # every other transition is vendor-only. reason/reason_code are only
      # required (and validated) by Orders::TransitionStatus when
      # to_status is "cancelled".
      def transition
        to_status = params.require(:to_status)
        if customer_actor? && to_status != "cancelled"
          raise ApiError::Forbidden, "Customers may only cancel an order"
        end

        order = Orders::TransitionStatus.new(
          order: @order, to_status: to_status, actor_user: current_user,
          reason: params[:reason], reason_code: params[:reason_code]
        ).call
        render json: { order: OrderSerializer.call(order) }
      end

      # POST /api/v1/orders/:id/mark_paid — vendor's own assertion that
      # they've seen proof of payment (ADR 0009), not a verified transaction.
      def mark_paid
        order = Orders::MarkPaid.new(order: @order).call
        render json: { order: OrderSerializer.call(order) }
      end

      # PATCH /api/v1/orders/:id/items (items: [{ item_id, quantity }]) —
      # vendor-only (OrderPolicy#edit_items?); see Orders::EditItems for the
      # editable-status gate and availability re-check.
      def update_items
        changes = params.require(:items).map { |c| c.permit(:item_id, :quantity).to_h }
        order = Orders::EditItems.new(order: @order, changes: changes, actor_user: current_user).call
        render json: { order: OrderSerializer.call(order) }
      end

      private

      def set_order
        @order = Order.find(params[:id])
        authorize @order
      end

      def customer_actor?
        current_user.customer_profile.present? && @order.customer_profile.user_id == current_user.id
      end
    end
  end
end
