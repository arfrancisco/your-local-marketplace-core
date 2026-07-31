class Cart < ApplicationRecord
  belongs_to :customer_profile
  belongs_to :shop
  has_many :cart_items, dependent: :destroy
  has_many :items, through: :cart_items
  has_one :order

  STATUSES = %w[active converted abandoned].freeze

  validates :status, inclusion: { in: STATUSES }

  scope :active, -> { where(status: "active") }

  def subtotal_cents
    cart_items.sum { |ci| ci.quantity * ci.item.price_cents }
  end
end
