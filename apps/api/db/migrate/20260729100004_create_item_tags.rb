class CreateItemTags < ActiveRecord::Migration[8.1]
  def change
    create_table :item_tags do |t|
      t.references :item, null: false, foreign_key: true
      t.references :tag, null: false, foreign_key: true

      t.timestamps
    end

    add_index :item_tags, %i[item_id tag_id], unique: true
  end
end
