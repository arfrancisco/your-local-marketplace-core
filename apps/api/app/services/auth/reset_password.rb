module Auth
  # Confirms a password-reset code and sets a new password. Uses the same
  # generic failure message whether the email doesn't exist, the code is
  # wrong, or it's expired/consumed — no enumeration signal either way.
  # Revokes every existing API token on success: a password reset is a
  # reasonable moment to force re-login everywhere, in case the reset was
  # prompted by a compromised account.
  class ResetPassword
    INVALID_CODE_MESSAGE = "Invalid or expired code".freeze

    def initialize(email:, code:, new_password:)
      @email = email.to_s.strip.downcase
      @code = code
      @new_password = new_password
    end

    def call
      user = User.find_by("lower(email) = ?", @email)
      raise ApiError::UnprocessableEntity, INVALID_CODE_MESSAGE if user.nil?

      challenge = user.verification_challenges
                      .live
                      .where(purpose: "password_reset")
                      .order(created_at: :desc)
                      .first
      raise ApiError::UnprocessableEntity, INVALID_CODE_MESSAGE if challenge.nil?
      raise ApiError::UnprocessableEntity, INVALID_CODE_MESSAGE unless challenge.verify(@code)

      user.update!(password: @new_password)
      user.api_tokens.update_all(expires_at: Time.current)
      user
    end
  end
end
