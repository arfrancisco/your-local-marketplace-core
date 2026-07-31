module Orders
  # The vendor's own assertion that they've seen proof of payment (ADR 0009)
  # — trust-based, not a verified transaction. Idempotent: marking an
  # already-paid order paid again is a no-op, not an error.
  class MarkPaid
    def initialize(order:)
      @order = order
    end

    def call
      @order.update!(payment_status: "marked_paid") if @order.payment_status == "unpaid"
      @order
    end
  end
end
