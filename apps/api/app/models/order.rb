class Order < ApplicationRecord
  belongs_to :customer_profile
  belongs_to :shop
  belongs_to :cart, optional: true
  has_many :order_items, dependent: :destroy
  has_many :order_status_events, dependent: :destroy
  has_many :ratings, dependent: :destroy
  has_one :conversation, dependent: :destroy

  FULFILLMENT_METHODS = %w[pickup delivery].freeze
  STATUSES = %w[placed accepted preparing ready_for_pickup out_for_delivery completed rejected cancelled].freeze
  PAYMENT_STATUSES = %w[unpaid marked_paid].freeze

  # Legal status transitions (ADR 0003). Enforced by Orders::TransitionStatus,
  # never inferred from anything else (e.g. chat content — see ADR 0009).
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

  before_validation :generate_public_reference, on: :create

  validates :public_reference, presence: true, uniqueness: true
  validates :fulfillment_method, inclusion: { in: FULFILLMENT_METHODS }
  validates :status, inclusion: { in: STATUSES }
  validates :payment_status, inclusion: { in: PAYMENT_STATUSES }
  validates :subtotal_cents, :total_cents, numericality: { greater_than_or_equal_to: 0 }

  def can_transition_to?(to_status)
    TRANSITIONS.fetch(status, []).include?(to_status)
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
