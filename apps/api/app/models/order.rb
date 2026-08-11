class Order < ApplicationRecord
  belongs_to :customer_profile
  belongs_to :shop
  belongs_to :cart, optional: true
  has_many :order_items, dependent: :destroy
  has_many :order_status_events, dependent: :destroy
  has_many :ratings, dependent: :destroy
  has_many :short_links, dependent: :destroy
  has_one :conversation, dependent: :destroy

  FULFILLMENT_METHODS = %w[pickup delivery].freeze
  STATUSES = %w[placed accepted preparing ready_for_pickup out_for_delivery completed rejected cancelled].freeze
  PAYMENT_STATUSES = %w[unpaid marked_paid].freeze

  # Predefined cancellation reasons, shown as a required picker before a
  # cancellation is allowed to go through (Orders::TransitionStatus) — real
  # data on why cancellations happen, instead of none at all. Customer and
  # vendor get different lists since their reasons differ in kind. "other"
  # is the escape hatch that requires the free-text `reason` column instead
  # of just a code. Labels are plain constants, not a migration — safe to
  # reword any time.
  CUSTOMER_CANCELLATION_REASONS = {
    "changed_mind" => "I changed my mind",
    "found_elsewhere" => "Found a better price or option elsewhere",
    "taking_too_long" => "It's taking too long",
    "ordered_by_mistake" => "I ordered by mistake",
    "other" => "Other"
  }.freeze

  VENDOR_CANCELLATION_REASONS = {
    "item_unavailable" => "Item(s) no longer available",
    "unable_to_fulfill" => "Unable to fulfill in time",
    "customer_unreachable" => "Customer unreachable",
    "emergency_closure" => "Shop closing early / emergency",
    "other" => "Other"
  }.freeze

  # Legal status transitions (ADR 0003). Enforced by Orders::TransitionStatus,
  # never inferred from anything else (e.g. chat content — see ADR 0009).
  # This is the abstract state graph only — ready_for_pickup/out_for_delivery
  # are both listed as reachable from "preparing" here, but which one is
  # actually available on a *given* order additionally depends on its
  # fulfillment_method (see FULFILLMENT_SPECIFIC_TRANSITIONS below).
  TRANSITIONS = {
    "placed" => %w[accepted rejected cancelled],
    "accepted" => %w[preparing cancelled],
    "preparing" => %w[ready_for_pickup out_for_delivery],
    "ready_for_pickup" => %w[completed],
    "out_for_delivery" => %w[completed],
    "completed" => [],
    "rejected" => [],
    "cancelled" => []
  }.freeze

  # The two statuses in TRANSITIONS that only make sense for one
  # fulfillment_method — without this, a pickup order could be pushed to
  # "out_for_delivery" (and vice versa), which the state graph alone allows
  # since it has no concept of fulfillment_method at all.
  FULFILLMENT_SPECIFIC_TRANSITIONS = {
    "ready_for_pickup" => "pickup",
    "out_for_delivery" => "delivery"
  }.freeze

  # An order counts as demo if either party to it is a demo user — a
  # transaction between a real beta user and a seeded demo shop (or vice
  # versa) isn't a real transaction either.
  scope :demo, -> { where(customer_profile: CustomerProfile.demo).or(where(shop: Shop.demo)) }
  scope :real, -> { where(customer_profile: CustomerProfile.real).where(shop: Shop.real) }

  before_validation :generate_public_reference, on: :create

  validates :public_reference, presence: true, uniqueness: true
  validates :fulfillment_method, inclusion: { in: FULFILLMENT_METHODS }
  validates :status, inclusion: { in: STATUSES }
  validates :payment_status, inclusion: { in: PAYMENT_STATUSES }
  validates :subtotal_cents, :total_cents, numericality: { greater_than_or_equal_to: 0 }

  # Single source of truth for "what can this order actually move to right
  # now" — used both to validate an attempted transition (below) and to tell
  # the frontend which buttons to show (OrderSerializer), so the two can
  # never drift apart the way TRANSITIONS-alone-vs-fulfillment_method did.
  def available_transitions
    TRANSITIONS.fetch(status, []).select do |to_status|
      required_method = FULFILLMENT_SPECIFIC_TRANSITIONS[to_status]
      required_method.nil? || fulfillment_method == required_method
    end
  end

  def can_transition_to?(to_status)
    available_transitions.include?(to_status)
  end

  def demo?
    customer_profile.demo? || shop.demo?
  end

  private

  def generate_public_reference
    return if public_reference.present?

    loop do
      candidate = "ORD-#{SecureRandom.alphanumeric(8).upcase}"
      next if Order.exists?(public_reference: candidate)

      self.public_reference = candidate
      break
    end
  end
end
