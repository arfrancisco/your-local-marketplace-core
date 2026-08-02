class CreateVendorCustomerNotes < ActiveRecord::Migration[8.1]
  def change
    create_table :vendor_customer_notes do |t|
      t.references :vendor_profile, null: false, foreign_key: true
      t.references :customer_profile, null: false, foreign_key: true
      t.references :order, null: true, foreign_key: true
      t.text :note, null: false
      t.boolean :flagged, null: false, default: false

      t.timestamps
    end

    add_index :vendor_customer_notes, [:vendor_profile_id, :customer_profile_id],
              name: "index_vendor_customer_notes_on_vendor_and_customer"
  end
end
