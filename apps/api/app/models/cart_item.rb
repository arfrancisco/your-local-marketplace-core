class CartItem < ApplicationRecord
  belongs_to :cart
  belongs_to :item

  validates :quantity, numericality: { only_integer: true, greater_than: 0 }
  validates :item_id, uniqueness: { scope: :cart_id }

  def line_total_cents
    quantity * item.price_cents
  end
end
