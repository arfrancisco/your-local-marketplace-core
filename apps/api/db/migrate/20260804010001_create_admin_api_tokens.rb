class CreateAdminApiTokens < ActiveRecord::Migration[8.1]
  def change
    create_table :admin_api_tokens do |t|
      t.references :admin_user, null: false, foreign_key: true
      t.string :token_digest, null: false
      t.datetime :expires_at
      t.datetime :last_used_at

      t.timestamps
    end

    add_index :admin_api_tokens, :token_digest, unique: true
  end
end
