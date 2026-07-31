class CreateConversationReads < ActiveRecord::Migration[8.1]
  def change
    create_table :conversation_reads do |t|
      t.references :conversation, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.references :last_read_message, foreign_key: { to_table: :messages }
      t.datetime :last_read_at

      t.timestamps
    end

    add_index :conversation_reads, [:conversation_id, :user_id], unique: true, name: "index_conversation_reads_on_conversation_and_user"
  end
end
