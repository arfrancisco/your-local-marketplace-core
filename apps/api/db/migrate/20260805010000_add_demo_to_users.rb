class AddDemoToUsers < ActiveRecord::Migration[8.1]
  def change
    # Single source of truth for "is this seed/demo data, not a real beta
    # user." Everything else (shops, items, orders, ratings, ...) derives
    # its demo-ness from the user(s) it traces back to rather than storing
    # its own copy of the flag — see User#demo and the delegated demo?
    # methods on the associated models.
    add_column :users, :demo, :boolean, default: false, null: false
    add_index :users, :demo
  end
end
