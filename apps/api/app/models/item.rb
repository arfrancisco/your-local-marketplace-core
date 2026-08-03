class Item < ApplicationRecord
  include ImageAttachable

  belongs_to :shop
  has_many :item_tags, dependent: :destroy
  has_many :tags, through: :item_tags
  has_images :photos, max_count: 3

  validates :name, presence: true
  validates :price_cents, numericality: { only_integer: true, greater_than: 0 }
  validates :currency, presence: true
  validates :stock_count, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true

  # `enabled` (customer-visibility toggle, "might come back soon") vs.
  # `archived_at` (vendor's own "done with this, out of my active list,"
  # see AddArchivedAtToItems) are orthogonal, but every customer-facing
  # scope needs both checked — bake the archived exclusion into `enabled`
  # itself so every existing call site (ShopSerializer, ShopsController)
  # gets it for free with no change on their end.
  scope :enabled, -> { where(enabled: true, archived_at: nil) }
  scope :active, -> { where(archived_at: nil) }

  # A disabled item cannot be ordered but stays intact for historical orders.
  def enable!
    update!(enabled: true)
  end

  def disable!
    update!(enabled: false)
  end

  def archived?
    archived_at.present?
  end

  def archive!
    update!(archived_at: Time.current)
  end

  def unarchive!
    update!(archived_at: nil)
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
