# Self-hosted SMS link shortener (see docs/architecture.md and the
# order-notification plan) — a stable /s/:code redirect to an order's
# customer or vendor detail page. One row per (order, audience) pair,
# reused across every notification sent for that pair rather than minted
# fresh per message. target_path is computed from order_id/audience at
# redirect time, not stored, so it stays correct if routing ever changes.
class ShortLink < ApplicationRecord
  belongs_to :order

  AUDIENCES = %w[customer vendor].freeze

  validates :audience, inclusion: { in: AUDIENCES }
  validates :code, presence: true, uniqueness: true

  before_validation :generate_code, on: :create

  def self.for(order:, audience:)
    find_or_create_by!(order: order, audience: audience)
  end

  def target_path
    audience == "vendor" ? "/vendor/orders/#{order_id}" : "/orders/#{order_id}"
  end

  private

  def generate_code
    return if code.present?

    loop do
      candidate = SecureRandom.alphanumeric(7)
      next if ShortLink.exists?(code: candidate)

      self.code = candidate
      break
    end
  end
end
