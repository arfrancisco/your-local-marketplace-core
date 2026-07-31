class OrderStatusEvent < ApplicationRecord
  belongs_to :order
  belongs_to :actor_user, class_name: "User"

  validates :to_status, inclusion: { in: Order::STATUSES }
  validates :from_status, inclusion: { in: Order::STATUSES }, allow_nil: true
end
