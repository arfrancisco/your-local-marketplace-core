class CreateVendorProfiles < ActiveRecord::Migration[8.1]
  def change
    create_table :vendor_profiles do |t|
      t.references :user, null: false, foreign_key: true, index: { unique: true }
      t.string :display_name, null: false
      t.string :verification_status, null: false, default: "unverified"

      t.timestamps
    end
  end
end
