class CreateOrderStatusEvents < ActiveRecord::Migration[8.1]
  def change
    # Append-only audit log of every status transition, per ADR 0003. Always
    # written by Orders::TransitionStatus, never edited/deleted.
    create_table :order_status_events do |t|
      t.references :order, null: false, foreign_key: true
      t.string :from_status
      t.string :to_status, null: false
      t.references :actor_user, null: false, foreign_key: { to_table: :users }
      t.text :reason

      t.datetime :created_at, null: false
    end
  end
end
