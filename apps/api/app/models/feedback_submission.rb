class FeedbackSubmission < ApplicationRecord
  belongs_to :user, optional: true

  validates :message, presence: true

  scope :unresolved, -> { where(resolved_at: nil) }

  def resolved?
    resolved_at.present?
  end

  def resolve!
    update!(resolved_at: Time.current)
  end

  def reopen!
    update!(resolved_at: nil)
  end
end
