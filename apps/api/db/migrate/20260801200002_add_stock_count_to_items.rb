class AddStockCountToItems < ActiveRecord::Migration[8.1]
  def change
    add_column :items, :stock_count, :integer
  end
end
