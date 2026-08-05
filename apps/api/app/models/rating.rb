class Rating < ApplicationRecord
  belongs_to :order
  belongs_to :reviewer_user, class_name: "User"
  belongs_to :reviewee, polymorphic: true

  SCORE_RANGE = (1..5).freeze

  validates :score, inclusion: { in: SCORE_RANGE }
  # Mirrors the DB's composite unique index — a second submission for the same
  # order surfaces as a validation failure (422) instead of a raw index error.
  validates :reviewer_user_id, uniqueness: { scope: %i[order_id reviewee_type reviewee_id] }

  scope :demo, -> { where(order: Order.demo) }
  scope :real, -> { where(order: Order.real) }

  def demo?
    order.demo?
  end
end
