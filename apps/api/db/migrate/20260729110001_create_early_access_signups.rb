class CreateEarlyAccessSignups < ActiveRecord::Migration[8.1]
  def change
    # Prospect leads for the early-access demand test. Deliberately NOT users:
    # no password, no account — just captured interest so we can invite them
    # later. At least one of email/mobile is required (enforced in the model).
    create_table :early_access_signups do |t|
      t.string :email
      t.string :mobile_number
      t.string :name
      t.string :interest, null: false, default: "buyer" # buyer | seller | both
      t.string :context # optional: what they were viewing when they signed up

      t.timestamps
    end

    # Count unique interested people; case-insensitive on email.
    execute <<~SQL
      CREATE UNIQUE INDEX index_early_access_signups_on_lower_email
        ON early_access_signups (lower(email)) WHERE email IS NOT NULL;
    SQL
    add_index :early_access_signups, :mobile_number, unique: true, where: "mobile_number IS NOT NULL"
  end
end
