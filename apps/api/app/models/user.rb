class User < ApplicationRecord
  has_secure_password

  has_one :customer_profile, dependent: :destroy
  has_one :vendor_profile, dependent: :destroy
  has_many :addresses, dependent: :destroy
  has_many :verification_challenges, dependent: :destroy
  has_many :api_tokens, dependent: :destroy

  STATUSES = %w[active suspended].freeze

  # PH mobile only, in either the local (09XXXXXXXXX) or international
  # (+639XXXXXXXXX) shape — matches what normalize_mobile_number leaves
  # behind (digits + optional leading +). Anything else (wrong length,
  # wrong country code, garbage digit strings) is rejected outright rather
  # than silently accepted, since nothing downstream currently verifies
  # deliverability of this number.
  MOBILE_NUMBER_FORMAT = /\A(09\d{9}|\+639\d{9})\z/

  # Single source of truth for "is this seed/demo data" — every other model
  # (Shop, Item, Order, Rating, ...) derives its own demo?/scopes from the
  # user(s) it traces back to instead of storing a copy of this flag.
  scope :demo, -> { where(demo: true) }
  scope :real, -> { where(demo: false) }

  before_validation :normalize_email
  before_validation :normalize_mobile_number

  validates :email, presence: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP },
                    uniqueness: { case_sensitive: false }
  # Plus-addressing (name+tag@domain) is real mail syntax and Gmail/most
  # providers route it to the same inbox as the base address — allowing it
  # here would let one real inbox back an unlimited number of accounts.
  validate :email_must_not_use_plus_addressing
  validates :mobile_number, format: { with: MOBILE_NUMBER_FORMAT }, uniqueness: true, allow_nil: true
  validates :status, inclusion: { in: STATUSES }

  def email_verified?
    email_verified_at.present?
  end

  def mobile_verified?
    mobile_verified_at.present?
  end

  # Authorization is capability-based, not a single role column.
  def vendor?
    vendor_profile.present?
  end

  def customer?
    customer_profile.present?
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase.presence
  end

  def normalize_mobile_number
    # Keep only leading + and digits; blank becomes nil so the unique index and
    # allow_nil validation treat "not provided" consistently.
    normalized = mobile_number.to_s.gsub(/[^\d+]/, "")
    self.mobile_number = normalized.presence
  end

  def email_must_not_use_plus_addressing
    return if email.blank?

    errors.add(:email, "can't contain a \"+\" — please use your plain email address") if email.include?("+")
  end
end
