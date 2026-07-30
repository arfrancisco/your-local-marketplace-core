class Shop < ApplicationRecord
  include ImageAttachable

  belongs_to :vendor_profile
  has_many :items, dependent: :destroy
  has_many :carts, dependent: :destroy
  has_images :photos, max_count: 3

  FULFILLMENT_METHODS = %w[pickup delivery].freeze
  STATUSES = %w[draft active suspended].freeze

  before_validation :generate_slug, on: :create

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validate :fulfillment_methods_present_and_valid

  # Shops a customer may discover: active and currently accepting orders.
  scope :listed, -> { where(status: "active", accepting_orders: true) }

  # Keyword search across the shop itself and its catalog (item names, tags) —
  # not geo/distance (ADR 0002), just text matching so "bread" or "vegan"
  # surfaces the right shop even when the shop's own name doesn't say it.
  scope :search, lambda { |term|
    next all if term.blank?

    like = "%#{sanitize_sql_like(term)}%"
    where(
      "shops.name ILIKE :like OR shops.description ILIKE :like OR EXISTS (
         SELECT 1 FROM items
         LEFT JOIN item_tags ON item_tags.item_id = items.id
         LEFT JOIN tags ON tags.id = item_tags.tag_id
         WHERE items.shop_id = shops.id
           AND items.enabled = TRUE
           AND (items.name ILIKE :like OR tags.name ILIKE :like)
       )",
      like: like
    )
  }

  # The manual open switch. Opening also activates a draft shop so a vendor can
  # go from "created" to "discoverable" in one action (M1 acceptance).
  def open!
    update!(status: "active", accepting_orders: true)
  end

  def close!
    update!(accepting_orders: false)
  end

  def open?
    status == "active" && accepting_orders?
  end

  private

  # Slug is derived from the name once, at creation, and then stable (it is part
  # of the shop's public URL, /shops/:slug). Collisions get a numeric suffix.
  def generate_slug
    return if slug.present?

    base = name.to_s.parameterize.presence || "shop"
    candidate = base
    suffix = 1
    while Shop.exists?(slug: candidate)
      suffix += 1
      candidate = "#{base}-#{suffix}"
    end
    self.slug = candidate
  end

  def fulfillment_methods_present_and_valid
    methods = Array(fulfillment_methods).reject(&:blank?)
    if methods.empty?
      errors.add(:fulfillment_methods, "must include at least one of: #{FULFILLMENT_METHODS.join(', ')}")
    elsif (methods - FULFILLMENT_METHODS).any?
      errors.add(:fulfillment_methods, "contains an unsupported method")
    end
  end
end
