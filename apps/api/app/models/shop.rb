class Shop < ApplicationRecord
  include ImageAttachable

  belongs_to :vendor_profile
  has_many :items, dependent: :destroy
  has_many :carts, dependent: :destroy
  has_many :orders, dependent: :destroy
  has_many :ratings, as: :reviewee, dependent: :destroy
  # Shop identity images (Facebook-style): one square profile picture, one
  # wide cover photo. Cropped client-side before upload to fixed aspect
  # ratios, so the server just stores whatever single file it's given per
  # field — replaces the older generic multi-photo "photos" bucket entirely.
  has_images :profile_photo, max_count: 1
  has_images :cover_photo, max_count: 1
  has_images :opening_message_photos, max_count: 5

  FULFILLMENT_METHODS = %w[pickup delivery].freeze
  STATUSES = %w[draft active suspended].freeze

  # Canonical ordered list of vendor-web's shop-setup wizard steps. This is the
  # source of truth — the frontend mirrors it, so add/rename/reorder here first.
  # A shop's `onboarding_step` is the step to RESUME at, not the last one
  # finished: a brand-new shop sits at "shop" having completed nothing.
  ONBOARDING_STEPS = %w[shop photos items payment].freeze

  before_validation :generate_slug, on: :create

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true
  validates :status, inclusion: { in: STATUSES }
  validates :onboarding_step, inclusion: { in: ONBOARDING_STEPS }
  # One shop per vendor for now. Not a DB constraint (no concurrent-write
  # pressure yet at this scale) — lift this if multi-shop vendors are ever
  # supported.
  validates :vendor_profile_id, uniqueness: true
  validate :fulfillment_methods_present_and_valid

  # Shops a customer may discover: active and currently accepting orders.
  scope :listed, -> { where(status: "active", accepting_orders: true) }

  # Keyword search across the shop itself and its catalog (item names, tags) —
  # not geo/distance (ADR 0002), just text matching so "bread" or "vegan"
  # surfaces the right shop even when the shop's own name doesn't say it.
  #
  # Tokenized per word (AND across words, OR within each word's own match), not
  # matched as one literal phrase — a natural query like "iced coffee" should
  # find a shop whose "Iced Spanish Latte" and "Coffee" tag are two different
  # items, not require that exact phrase to appear verbatim anywhere.
  scope :search, lambda { |term|
    words = term.to_s.strip.split(/\s+/).reject(&:blank?)
    words.reduce(all) { |scope, word| scope.matching_word(word) }
  }

  scope :demo, -> { joins(vendor_profile: :user).merge(User.demo) }
  scope :real, -> { joins(vendor_profile: :user).merge(User.real) }

  scope :matching_word, lambda { |word|
    like = "%#{sanitize_sql_like(word)}%"
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
  # go from "created" to "discoverable" in one action (M1 acceptance). A
  # vendor under a tier-1 cancellation-abuse restriction (Orders::
  # CancellationAbuseCheck) can't just reopen to bypass it — the restriction
  # has to be cleared by an admin first.
  #
  # The two readiness guards below apply to EVERY open path on purpose,
  # including the dashboard's existing open toggle, not just the end of the
  # setup wizard. A shop that is discoverable but unbuyable is worse for a
  # customer than a shop that is simply closed.
  def open!
    if vendor_profile.restricted?
      raise ApiError.new(
        "This shop is temporarily restricted from reopening due to repeated order cancellations. " \
        "Contact team.kapitmarket@gmail.com to request a review.",
        code: "cancellation_restricted", status: :forbidden
      )
    end

    # There is no payment gateway (ADR 0009) — the opening message IS the
    # payment mechanism, auto-posted into each order's chat. Without one a
    # customer who orders has no way to find out how to pay.
    if opening_message.blank?
      raise ApiError.new(
        "Add an opening message before opening your shop. It is how customers find out how to pay you.",
        code: "opening_message_required", status: :unprocessable_entity
      )
    end

    # An open shop takes a slot in the daily rotating shop list (ADR 0007).
    # Spending one on an empty catalog wastes a customer's tap.
    unless items.enabled.exists?
      raise ApiError.new(
        "Add at least one available item before opening your shop.",
        code: "no_enabled_items", status: :unprocessable_entity
      )
    end

    update!(status: "active", accepting_orders: true)
  end

  def close!
    update!(accepting_orders: false)
  end

  def open?
    status == "active" && accepting_orders?
  end

  def onboarding_complete?
    onboarding_completed_at.present?
  end

  def demo?
    vendor_profile.demo?
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
