module Auth
  # Mirrors Auth::AuthenticateUser exactly. The failure message is
  # deliberately identical for "no such email" and "wrong password" so the
  # endpoint can't be used to enumerate admin accounts.
  class AuthenticateAdminUser
    Result = Struct.new(:admin_user, :token, keyword_init: true)

    def initialize(email:, password:)
      @email = email.to_s.strip.downcase
      @password = password
    end

    def call
      admin_user = AdminUser.find_by("lower(email) = ?", @email)
      raise ApiError::Unauthorized, "Invalid email or password" unless admin_user&.authenticate(@password)
      raise ApiError::Forbidden, "This account is suspended" if admin_user.status == "suspended"

      admin_user.update!(last_signed_in_at: Time.current)
      _record, raw = AdminApiToken.issue!(admin_user)
      Result.new(admin_user: admin_user, token: raw)
    end
  end
end
