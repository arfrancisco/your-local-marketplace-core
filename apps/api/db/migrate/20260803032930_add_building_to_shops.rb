class AddBuildingToShops < ActiveRecord::Migration[8.1]
  # Public-safe location label ("Tower B"), split out from the existing
  # free-text `address` column (which stays but becomes private — vendor's
  # exact unit was never meant to be broadcast to every anonymous browser).
  def change
    add_column :shops, :building, :string
  end
end
