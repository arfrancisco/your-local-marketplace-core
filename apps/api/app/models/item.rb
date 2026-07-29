class Item < ApplicationRecord
  include ImageAttachable

  belongs_to :shop
  has_many :item_tags, dependent: :destroy
  has_many :tags, through: :item_tags
  has_images :photos, max_count: 6

  validates :name, presence: true
  validates :price_cents, numericality: { only_integer: true, greater_than: 0 }
  validates :currency, presence: true

  scope :enabled, -> { where(enabled: true) }

  # A disabled item cannot be ordered but stays intact for historical orders.
  def enable!
    update!(enabled: true)
  end

  def disable!
    update!(enabled: false)
  end
end
