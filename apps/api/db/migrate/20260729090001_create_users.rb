class CreateUsers < ActiveRecord::Migration[8.1]
  def change
    create_table :users do |t|
      t.string :email, null: false
      t.string :mobile_number
      t.string :password_digest, null: false
      t.datetime :email_verified_at
      t.datetime :mobile_verified_at
      t.string :status, null: false, default: "active"
      t.datetime :last_signed_in_at

      t.timestamps
    end

    # Email is matched case-insensitively; enforce uniqueness on the normalized
    # (lowercased) value so "A@x.com" and "a@x.com" cannot both register.
    execute <<~SQL
      CREATE UNIQUE INDEX index_users_on_lower_email ON users (lower(email));
    SQL
    add_index :users, :mobile_number, unique: true, where: "mobile_number IS NOT NULL"
  end
end
