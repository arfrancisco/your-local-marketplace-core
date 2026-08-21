class AddOnboardingToShops < ActiveRecord::Migration[8.1]
  def up
    # Tracks the vendor-web shop-setup wizard. `onboarding_step` is the step to
    # RESUME at, not the last one finished, so a brand-new shop starts at the
    # first step ("shop"). `onboarding_completed_at` present means the vendor
    # finished the wizard and should never be sent back into it.
    add_column :shops, :onboarding_step, :string, null: false, default: "shop"
    add_column :shops, :onboarding_completed_at, :datetime

    # Every shop that already exists predates the wizard, so it is complete by
    # definition. Without this backfill each live vendor would be dropped back
    # into a setup flow for a shop they finished months ago. Small table, so a
    # single inline UPDATE is fine — no batching needed.
    execute(<<~SQL.squish)
      UPDATE shops
      SET onboarding_completed_at = created_at,
          onboarding_step = 'payment'
    SQL
  end

  def down
    remove_column :shops, :onboarding_completed_at
    remove_column :shops, :onboarding_step
  end
end
