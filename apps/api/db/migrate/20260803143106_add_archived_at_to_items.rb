class AddArchivedAtToItems < ActiveRecord::Migration[8.1]
  def change
    # Soft delete: a vendor's way to permanently retire an item from their
    # own working list without ever touching order_items (already
    # snapshotted independently of the live Item row) — orthogonal to
    # `enabled`, which is a temporary customer-visibility toggle, not a
    # "done with this" signal. See Item#archived?/#archive!/#unarchive!.
    add_column :items, :archived_at, :datetime
  end
end
