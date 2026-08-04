class CreateAdminAuditLogs < ActiveRecord::Migration[8.1]
  def change
    create_table :admin_audit_logs do |t|
      # An admin_user is never deleted (only deactivated), so this should
      # never actually go null in practice — nullify is just the safe
      # choice if that policy ever changes.
      t.references :admin_user, null: true, foreign_key: { on_delete: :nullify }
      t.string :http_method, null: false
      t.string :path, null: false
      t.string :controller, null: false
      t.string :action, null: false
      t.string :resource_type
      t.bigint :resource_id
      t.integer :status_code
      t.jsonb :request_params
      t.string :ip_address

      t.timestamps
    end

    add_index :admin_audit_logs, [:resource_type, :resource_id]
    add_index :admin_audit_logs, :created_at
  end
end
