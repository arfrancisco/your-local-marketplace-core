class CreateCustomerProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :customer_profiles do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :display_name, null: false
      t.references :default_address, null: true, foreign_key: { to_table: :addresses }

      t.timestamps
    end
  end
end
