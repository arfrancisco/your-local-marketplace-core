# An admin operator account — deliberately a separate model from `User`
# rather than a role on it (see docs/adr/0010-per-admin-accounts.md). Mirrors
# User's auth-relevant conventions (has_secure_password, email normalization/
# uniqueness, STATUSES) without pulling in any of User's marketplace-specific
# associations.
class AdminUser < ApplicationRecord
  has_secure_password

  has_many :admin_api_tokens, dependent: :destroy
  has_many :admin_audit_logs, dependent: :nullify

  STATUSES = %w[active suspended].freeze

  before_validation :normalize_email

  validates :email, presence: true,
                    format: { with: URI::MailTo::EMAIL_REGEXP },
                    uniqueness: { case_sensitive: false }
  validates :status, inclusion: { in: STATUSES }

  def active?
    status == "active"
  end

  private

  def normalize_email
    self.email = email.to_s.strip.downcase.presence
  end
end
