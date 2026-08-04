class CreateAdminUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :admin_users do |t|
      t.string :email, null: false
      t.string :password_digest, null: false
      t.string :status, null: false, default: "active"
      t.string :first_name
      t.string :last_name
      t.datetime :last_signed_in_at

      t.timestamps
    end

    add_index :admin_users, "lower((email)::text)", unique: true, name: "index_admin_users_on_lower_email"
  end
end
