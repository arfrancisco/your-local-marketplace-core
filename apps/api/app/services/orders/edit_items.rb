module Orders
  # Vendor-initiated edit to an already-placed order's line items — swap a
  # sold-out item, adjust a quantity — after telling the customer first via
  # the existing per-order chat. Deliberately lighter-weight than ADR 0005's
  # original accept/reject/withdraw plan: no formal approval gate, just
  # edit-after-notifying, narrated into the chat afterward (ADR 0009 — chat
  # narrates, never drives, state changes).
  #
  # Only allowed while the order is still early in its lifecycle — once the
  # vendor has committed to a fulfillment path (ready_for_pickup/
  # out_for_delivery) or the order is terminal, edits are no longer allowed.
  class EditItems
    EDITABLE_STATUSES = %w[placed accepted preparing].freeze

    # changes: array of { item_id:, quantity: } — quantity 0 (or omitted)
    # removes the line; an item_id not already on the order adds it.
    def initialize(order:, changes:, actor_user:)
      @order = order
      @changes = changes
      @actor_user = actor_user
    end

    def call
      unless EDITABLE_STATUSES.include?(@order.status)
        raise ApiError::UnprocessableEntity, "Cannot edit items on an order that is #{@order.status}"
      end

      resolved = resolve_changes

      summary = { added: [], removed: [], updated: [] }
      ActiveRecord::Base.transaction do
        resolved.each { |change| apply_change(change, summary) }
        subtotal = @order.order_items.reload.sum(:line_total_cents)
        @order.update!(subtotal_cents: subtotal, total_cents: subtotal)
      end

      post_system_message(summary)
      @order
    end

    private

    # Resolves and validates every change up front — a disabled/sold-out (or
    # cross-shop) item anywhere in the batch fails the whole edit before
    # anything is written, same spirit as Carts::Checkout re-validating
    # availability at checkout time.
    def resolve_changes
      @changes.map do |change|
        item_id = change[:item_id] || change["item_id"]
        quantity = (change[:quantity] || change["quantity"]).to_i
        existing = @order.order_items.find_by(item_id: item_id)

        next { existing: existing, item: nil, quantity: 0 } if quantity <= 0

        item = Item.find(item_id)
        if item.shop_id != @order.shop_id
          raise ApiError::UnprocessableEntity, "#{item.name} is not from this order's shop"
        end
        unless item.enabled? && !item.sold_out?
          raise ApiError::UnprocessableEntity.new(
            "#{item.name} is no longer available", details: { unavailable_item: item.name }
          )
        end

        { existing: existing, item: item, quantity: quantity }
      end
    end

    def apply_change(change, summary)
      existing = change[:existing]

      if change[:quantity] <= 0
        return unless existing

        summary[:removed] << "#{existing.quantity}x #{existing.item_name}"
        existing.destroy!
        return
      end

      item = change[:item]
      quantity = change[:quantity]

      if existing
        summary[:updated] << "#{existing.item_name} to #{quantity}x" if existing.quantity != quantity
        existing.update!(unit_price_cents: item.price_cents, quantity: quantity, line_total_cents: item.price_cents * quantity)
      else
        summary[:added] << "#{quantity}x #{item.name}"
        @order.order_items.create!(
          item: item,
          item_name: item.name,
          item_description: item.description,
          unit_price_cents: item.price_cents,
          quantity: quantity,
          line_total_cents: item.price_cents * quantity
        )
      end
    end

    def post_system_message(summary)
      parts = []
      parts << "added #{summary[:added].join(', ')}" if summary[:added].any?
      parts << "removed #{summary[:removed].join(', ')}" if summary[:removed].any?
      parts << "updated #{summary[:updated].join(', ')}" if summary[:updated].any?
      return if parts.empty?

      Messaging::PostMessage.new(
        conversation: @order.conversation,
        sender_user: @actor_user,
        message_type: "system",
        body: "Vendor updated this order: #{parts.join('; ')}."
      ).call
    end
  end
end
