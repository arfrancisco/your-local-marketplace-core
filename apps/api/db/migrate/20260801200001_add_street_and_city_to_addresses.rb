class AddStreetAndCityToAddresses < ActiveRecord::Migration[8.1]
  def change
    add_column :addresses, :street_address, :string
    add_column :addresses, :city, :string
  end
end
