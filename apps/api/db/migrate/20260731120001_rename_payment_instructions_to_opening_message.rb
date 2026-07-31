class RenamePaymentInstructionsToOpeningMessage < ActiveRecord::Migration[8.1]
  def change
    rename_column :shops, :payment_instructions, :opening_message

    # The QR attachment slot is being widened from a single image to a
    # gallery (multiple QR codes, e.g. GCash + bank transfer) — carry over
    # any already-attached demo QR rather than silently orphaning it.
    reversible do |dir|
      dir.up do
        execute <<~SQL
          UPDATE active_storage_attachments
          SET name = 'opening_message_photos'
          WHERE name = 'payment_qr_code' AND record_type = 'Shop'
        SQL
      end
      dir.down do
        execute <<~SQL
          UPDATE active_storage_attachments
          SET name = 'payment_qr_code'
          WHERE name = 'opening_message_photos' AND record_type = 'Shop'
        SQL
      end
    end
  end
end
