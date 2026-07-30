class EarlyAccessSignup < ApplicationRecord
  INTERESTS = %w[buyer seller both].freeze

  before_validation :normalize_contact

  validates :interest, inclusion: { in: INTERESTS }
  validates :email, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_nil: true
  validates :email, uniqueness: { case_sensitive: false }, allow_nil: true
  validates :mobile_number, uniqueness: true, allow_nil: true
  validate :email_or_mobile_present

  # Finds an existing signup for either contact detail (so a repeat submission is
  # recognized rather than erroring), else builds a new one.
  def self.for_contact(email:, mobile_number:)
    normalized_email = email.to_s.strip.downcase.presence
    normalized_mobile = mobile_number.to_s.gsub(/[^\d+]/, "").presence

    existing = where("lower(email) = ?", normalized_email).first if normalized_email
    existing ||= find_by(mobile_number: normalized_mobile) if normalized_mobile
    existing
  end

  private

  def normalize_contact
    self.email = email.to_s.strip.downcase.presence
    self.mobile_number = mobile_number.to_s.gsub(/[^\d+]/, "").presence
  end

  def email_or_mobile_present
    return if email.present? || mobile_number.present?

    errors.add(:base, "Enter an email or a mobile number")
  end
end
