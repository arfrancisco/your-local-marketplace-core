class FeedbackSubmission < ApplicationRecord
  belongs_to :user, optional: true

  validates :message, presence: true
end
