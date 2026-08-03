class OrderStatusEvent < ApplicationRecord
  belongs_to :order
  belongs_to :actor_user, class_name: "User"

  # Only cancellations require a reason_code (enforced in
  # Orders::TransitionStatus, which also knows which actor's list applies) —
  # every other transition leaves it nil, so this just validates shape, not
  # presence.
  VALID_REASON_CODES = (Order::CUSTOMER_CANCELLATION_REASONS.keys + Order::VENDOR_CANCELLATION_REASONS.keys).uniq.freeze

  validates :to_status, inclusion: { in: Order::STATUSES }
  validates :from_status, inclusion: { in: Order::STATUSES }, allow_nil: true
  validates :reason_code, inclusion: { in: VALID_REASON_CODES }, allow_nil: true
end
