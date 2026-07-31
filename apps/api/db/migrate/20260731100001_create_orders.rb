class CreateOrders < ActiveRecord::Migration[8.1]
  def change
    # Snapshot record of a placed order (ADR 0003). Prices/names never re-read
    # live from item/shop — see order_items. payment_status is vendor-asserted
    # (ADR 0009), not a verified transaction.
    create_table :orders do |t|
      t.string :public_reference, null: false
      t.references :customer_profile, null: false, foreign_key: true
      t.references :shop, null: false, foreign_key: true
      t.references :cart, foreign_key: true # nullable — the cart it was converted from
      t.string :fulfillment_method, null: false # pickup | delivery
      t.string :status, null: false, default: "placed"
      t.integer :subtotal_cents, null: false
      t.integer :total_cents, null: false
      t.string :currency, null: false, default: "PHP"
      t.string :payment_status, null: false, default: "unpaid" # unpaid | marked_paid
      t.text :customer_note
      t.text :vendor_note
      t.datetime :placed_at, null: false
      t.datetime :accepted_at
      t.datetime :completed_at
      t.datetime :cancelled_at

      t.timestamps
    end

    add_index :orders, :public_reference, unique: true
    add_index :orders, [:shop_id, :status]
    add_index :orders, [:customer_profile_id, :status]
  end
end
