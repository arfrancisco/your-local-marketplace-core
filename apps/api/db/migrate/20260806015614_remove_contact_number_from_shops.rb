class RemoveContactNumberFromShops < ActiveRecord::Migration[8.1]
  def change
    remove_column :shops, :contact_number, :string
  end
end
