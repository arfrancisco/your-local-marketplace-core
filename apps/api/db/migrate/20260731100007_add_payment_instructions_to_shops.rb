class AddPaymentInstructionsToShops < ActiveRecord::Migration[8.1]
  def change
    # Vendor-configured, shop-level (not vendor-level — a vendor with
    # multiple shops may use different payment setups). Auto-posted as the
    # first chat message on checkout (ADR 0009). payment_qr_code image
    # attachment is added via ImageAttachable, not a column here.
    add_column :shops, :payment_instructions, :text
  end
end
