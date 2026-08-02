class CreateRatings < ActiveRecord::Migration[8.1]
  def change
    create_table :ratings do |t|
      t.references :order, null: false, foreign_key: true
      t.references :reviewer_user, null: false, foreign_key: { to_table: :users }
      t.references :reviewee, polymorphic: true, null: false
      t.integer :score, null: false
      t.text :comment

      t.timestamps
    end

    add_index :ratings, [:order_id, :reviewer_user_id, :reviewee_type, :reviewee_id],
              unique: true, name: "index_ratings_on_order_reviewer_reviewee"
  end
end
