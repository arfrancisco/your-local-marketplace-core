class CreateVerificationChallenges < ActiveRecord::Migration[8.1]
  def change
    create_table :verification_challenges do |t|
      t.references :user, null: false, foreign_key: true
      t.string :channel, null: false          # email | sms
      t.string :purpose, null: false           # e.g. email_verification, mobile_verification
      t.string :code_digest, null: false       # hashed code — never store plaintext
      t.string :sent_to, null: false           # the email/number the code went to
      t.datetime :expires_at, null: false
      t.datetime :consumed_at
      t.integer :attempts_count, null: false, default: 0

      t.timestamps
    end

    # One live challenge per user+channel+purpose is found by "most recent
    # unconsumed"; index supports that lookup.
    add_index :verification_challenges, %i[user_id channel purpose consumed_at]
  end
end
