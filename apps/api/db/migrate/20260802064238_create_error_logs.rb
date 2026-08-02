class CreateErrorLogs < ActiveRecord::Migration[8.1]
  def change
    create_table :error_logs do |t|
      t.string :source, null: false
      t.string :exception_class, null: false
      t.text :message, null: false
      t.text :backtrace
      t.string :request_path
      t.string :request_method
      t.references :user, null: true, foreign_key: true
      t.string :fingerprint, null: false
      t.integer :occurrences_count, null: false, default: 1
      t.datetime :first_seen_at, null: false
      t.datetime :last_seen_at, null: false
      t.datetime :resolved_at

      t.timestamps
    end

    add_index :error_logs, :fingerprint, unique: true
    add_index :error_logs, :resolved_at
  end
end
