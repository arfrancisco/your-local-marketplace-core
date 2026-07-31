class CreateConversations < ActiveRecord::Migration[8.1]
  def change
    # One conversation per order (ADR 0003/0009), created at checkout.
    create_table :conversations do |t|
      t.references :order, null: false, foreign_key: true, index: { unique: true }

      t.timestamps
    end
  end
end
