class CreateAddresses < ActiveRecord::Migration[8.1]
  def change
    # Descriptive only, no latitude/longitude — there is no distance logic in
    # this product (ADR 0002). Addresses say where to walk to, in words.
    create_table :addresses do |t|
      t.references :user, null: true, foreign_key: true
      t.string :label
      t.string :recipient_name
      t.string :mobile_number
      t.string :unit
      t.string :building
      t.text :notes
      t.text :delivery_instructions

      t.timestamps
    end
  end
end
