class DropEarlyAccessSignups < ActiveRecord::Migration[8.1]
  # Early-access lead capture was a pre-launch demand-test demo, superseded
  # by real customer registration. The feature (model, controllers, admin UI)
  # has been removed; this drops its now-unused table. We drop the table via
  # a new migration rather than deleting the original
  # 20260729110001_create_early_access_signups.rb migration file, since that
  # migration has already run against deployed databases (see CLAUDE.md /
  # this repo's deploy pattern: db:migrate, not db:schema:load, in production).
  def change
    drop_table :early_access_signups do |t|
      t.string "context"
      t.datetime "created_at", null: false
      t.string "email"
      t.string "interest", default: "buyer", null: false
      t.string "mobile_number"
      t.string "name"
      t.datetime "updated_at", null: false
      t.index "lower((email)::text)", name: "index_early_access_signups_on_lower_email", unique: true, where: "(email IS NOT NULL)"
      t.index ["mobile_number"], name: "index_early_access_signups_on_mobile_number", unique: true, where: "(mobile_number IS NOT NULL)"
    end
  end
end
