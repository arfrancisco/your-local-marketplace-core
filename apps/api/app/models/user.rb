class User < ApplicationRecord
  has_secure_password

  has_one :customer_profile, dependent: :destroy
  has_one :vendor_profile, dependent: :destroy
  has_many :addresses, dependent: :destroy
  has_many :verification_challenges, dependent: :destroy
  has_many :api_tokens, dependent: :destroy

  STATUSES = %w[active suspended].freeze

  before_validation :normalize_email
  before_validation :normalize_mobile_number

  validates :email, presence: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP },
                    uniqueness: { case_sensitive: false }
  validates :mobile_number, uniqueness: true, allow_nil: true
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
end
