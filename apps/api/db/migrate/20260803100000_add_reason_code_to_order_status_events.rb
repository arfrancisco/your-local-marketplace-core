class AddReasonCodeToOrderStatusEvents < ActiveRecord::Migration[8.1]
  def change
    # Predefined reason picked from a list (Order::CUSTOMER_CANCELLATION_REASONS
    # / VENDOR_CANCELLATION_REASONS); only cancellations require one, so this
    # stays nullable rather than a NOT NULL column shared by every transition.
    # The existing `reason` text column holds the free-text detail, required
    # only when reason_code is "other".
    add_column :order_status_events, :reason_code, :string
  end
end
