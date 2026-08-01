class AddResidencyFieldsToCustomerProfiles < ActiveRecord::Migration[8.1]
  def change
    add_column :customer_profiles, :is_resident, :boolean, null: false, default: false
    add_column :customer_profiles, :willing_to_verify_residency, :boolean
  end
end
