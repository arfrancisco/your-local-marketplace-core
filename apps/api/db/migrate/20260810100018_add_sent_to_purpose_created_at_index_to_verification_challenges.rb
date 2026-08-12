class AddSentToPurposeCreatedAtIndexToVerificationChallenges < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  # Verifications::IssueChallenge's per-destination rate cap filters on
  # sent_to/purpose/created_at on every single challenge issuance (every
  # registration + every resend) -- the hottest path that query touches,
  # previously unindexed (only user_id and (user_id, channel, purpose,
  # consumed_at) existed). :concurrently avoids locking the table for
  # writes while the index builds on a live database.
  def change
    add_index :verification_challenges, [:sent_to, :purpose, :created_at], algorithm: :concurrently
  end
end
