class CreateItems < ActiveRecord::Migration[8.1]
  def change
    create_table :items do |t|
      t.references :shop, null: false, foreign_key: true
      t.string :name, null: false
      t.text :description
      # Money is stored as integer cents; currency alongside it. Never a float.
      t.integer :price_cents, null: false
      t.string :currency, null: false, default: "PHP"
      # A disabled item stays visible in historical orders but cannot be ordered.
      t.boolean :enabled, null: false, default: true
      t.integer :position, null: false, default: 0

      t.timestamps
    end

    add_index :items, %i[shop_id position]
  end
end
