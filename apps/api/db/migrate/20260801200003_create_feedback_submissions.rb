class CreateFeedbackSubmissions < ActiveRecord::Migration[8.1]
  def change
    create_table :feedback_submissions do |t|
      t.references :user, null: true, foreign_key: true
      t.string :email
      t.text :message, null: false
      t.string :page_url

      t.timestamps
    end
  end
end
