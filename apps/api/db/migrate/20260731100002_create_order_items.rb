class CreateOrderItems < ActiveRecord::Migration[8.1]
  def change
    # Snapshot row — item_name/unit_price_cents are copied at checkout and
    # never re-read live, even if the item is later edited or deleted
    # (item_id is nullable so the row survives item deletion).
    create_table :order_items do |t|
      t.references :order, null: false, foreign_key: true
      t.references :item, foreign_key: true
      t.string :item_name, null: false
      t.text :item_description
      t.integer :unit_price_cents, null: false
      t.integer :quantity, null: false
      t.integer :line_total_cents, null: false
      t.text :customer_note

      t.timestamps
    end
  end
end
