class CreateCarts < ActiveRecord::Migration[8.1]
  def change
    # A cart is scoped to exactly one shop (ADR 0008) — never multi-vendor.
    # A customer may have a separate active cart per shop at once.
    create_table :carts do |t|
      t.references :customer_profile, null: false, foreign_key: true
      t.references :shop, null: false, foreign_key: true
      t.string :status, null: false, default: "active" # active | converted | abandoned

      t.timestamps
    end

    # Enforces "one active cart per customer per shop" at the DB level.
    execute <<~SQL
      CREATE UNIQUE INDEX index_carts_on_customer_and_shop_when_active
        ON carts (customer_profile_id, shop_id) WHERE status = 'active';
    SQL
  end
end
