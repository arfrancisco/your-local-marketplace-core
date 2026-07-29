class CreateShops < ActiveRecord::Migration[8.1]
  def change
    create_table :shops do |t|
      t.references :vendor_profile, null: false, foreign_key: true
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.string :contact_number
      # Descriptive address only — unit/building text, no lat/lng (ADR 0002).
      t.string :address
      # Postgres array of "pickup" / "delivery"; at least one required.
      t.string :fulfillment_methods, array: true, null: false, default: []
      # draft (unlisted) | active (listed) | suspended (admin action).
      t.string :status, null: false, default: "draft"
      # The manual open/close switch; only meaningful while active.
      t.boolean :accepting_orders, null: false, default: false

      t.timestamps
    end

    add_index :shops, :slug, unique: true
    add_index :shops, %i[status accepting_orders]
  end
end
