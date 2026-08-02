class AddResolvedAtToFeedbackSubmissions < ActiveRecord::Migration[8.1]
  def change
    add_column :feedback_submissions, :resolved_at, :datetime
    add_index :feedback_submissions, :resolved_at
  end
end
