class CreateCartItems < ActiveRecord::Migration[8.1]
  def change
    create_table :cart_items do |t|
      t.references :cart, null: false, foreign_key: true
      t.references :item, null: false, foreign_key: true
      t.integer :quantity, null: false, default: 1
      t.text :customer_note

      t.timestamps
    end

    # One row per item per cart; adding an already-present item increments
    # quantity instead of creating a duplicate row.
    add_index :cart_items, %i[cart_id item_id], unique: true
  end
end
