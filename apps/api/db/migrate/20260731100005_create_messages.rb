class CreateMessages < ActiveRecord::Migration[8.1]
  def change
    # message_type "system" is the vendor's auto-posted payment message
    # (ADR 0009) — sender_user_id is nullable for those (no human author).
    # Image attachment (max 1 per ADR 0006) lives on the model via
    # ImageAttachable, not a column here.
    create_table :messages do |t|
      t.references :conversation, null: false, foreign_key: true
      t.references :sender_user, foreign_key: { to_table: :users }
      t.text :body
      t.string :message_type, null: false, default: "text" # text | image | system

      t.datetime :created_at, null: false
      t.datetime :edited_at
    end

    add_index :messages, [:conversation_id, :created_at]
  end
end
