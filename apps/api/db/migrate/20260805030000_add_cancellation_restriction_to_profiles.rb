class AddCancellationRestrictionToProfiles < ActiveRecord::Migration[8.1]
  def change
    # Tier-1 (temporary, admin-clearable) and permanent-count columns for
    # Orders::CancellationAbuseCheck. _restricted_at present means currently
    # restricted; _count is never decremented, so it's what distinguishes a
    # first offense from a second (tier-2, full suspension) even after a
    # tier-1 restriction was cleared.
    add_column :customer_profiles, :cancellation_restricted_at, :datetime
    add_column :customer_profiles, :cancellation_restriction_count, :integer, null: false, default: 0

    add_column :vendor_profiles, :cancellation_restricted_at, :datetime
    add_column :vendor_profiles, :cancellation_restriction_count, :integer, null: false, default: 0
  end
end
