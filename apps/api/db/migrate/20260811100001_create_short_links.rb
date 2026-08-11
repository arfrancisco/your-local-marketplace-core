class CreateShortLinks < ActiveRecord::Migration[8.1]
  def change
    # One row per (order, audience) pair, reused across every SMS sent for
    # that order/audience rather than minted fresh per message — see
    # ShortLink.for and OrderNotificationJob.
    create_table :short_links do |t|
      t.references :order, null: false, foreign_key: true
      t.string :audience, null: false
      t.string :code, null: false

      t.timestamps
    end

    add_index :short_links, :code, unique: true
    add_index :short_links, [:order_id, :audience], unique: true
  end
end
