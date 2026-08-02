module Admin
  module ApiTokenSerializer
    module_function

    # Never token_digest — same rule as everywhere else in this app.
    def call(api_token)
      {
        id: api_token.id,
        user_id: api_token.user_id,
        user_email: api_token.user.email,
        expires_at: api_token.expires_at,
        revoked: api_token.expires_at.present? && api_token.expires_at <= Time.current,
        last_used_at: api_token.last_used_at,
        created_at: api_token.created_at
      }
    end
  end
end
