module Auth
  # Verifies email + password and issues a token. The failure message is
  # deliberately identical for "no such email" and "wrong password" so the
  # endpoint can't be used to enumerate registered emails.
  class AuthenticateUser
    Result = Struct.new(:user, :token, keyword_init: true)

    def initialize(email:, password:)
      @email = email.to_s.strip.downcase
      @password = password
    end

    def call
      user = User.find_by("lower(email) = ?", @email)
      raise ApiError::Unauthorized, "Invalid email or password" unless user&.authenticate(@password)
      raise ApiError::Forbidden, "This account is suspended" if user.status == "suspended"

      user.update!(last_signed_in_at: Time.current)
      _record, raw = ApiToken.issue!(user)
      Result.new(user: user, token: raw)
    end
  end
end
