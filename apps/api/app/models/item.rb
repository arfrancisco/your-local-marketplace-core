class Item < ApplicationRecord
  include ImageAttachable

  belongs_to :shop
  has_many :item_tags, dependent: :destroy
  has_many :tags, through: :item_tags
  has_images :photos, max_count: 6

  validates :name, presence: true
  validates :price_cents, numericality: { only_integer: true, greater_than: 0 }
  validates :currency, presence: true
  validates :stock_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true

  scope :enabled, -> { where(enabled: true) }

  # A disabled item cannot be ordered but stays intact for historical orders.
  def enable!
    update!(enabled: true)
  end

  def disable!
    update!(enabled: false)
  end

  # Additive to `enabled`, not a replacement: `enabled` is the vendor's
  # manual publish/unpublish switch (hides the item entirely); stock_count
  # is a separate, optional signal — nil means "not tracked" (today's
  # behavior, unchanged), present-and-zero means sold out but still listed,
  # shown grayed out rather than hidden.
  def sold_out?
    stock_count.present? && stock_count <= 0
  end
end
