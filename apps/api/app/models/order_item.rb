class OrderItem < ApplicationRecord
  belongs_to :order
  belongs_to :item, optional: true # nullable — survives item deletion

  validates :item_name, presence: true
  validates :unit_price_cents, :line_total_cents, numericality: { greater_than_or_equal_to: 0 }
  validates :quantity, numericality: { only_integer: true, greater_than: 0 }
end
