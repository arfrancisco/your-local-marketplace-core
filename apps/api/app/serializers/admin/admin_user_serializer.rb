module Admin
  # Serializes an AdminUser (an admin operator account) — never
  # password_digest, same rule as everywhere else in this app.
  module AdminUserSerializer
    module_function

    def call(admin_user)
      {
        id: admin_user.id,
        email: admin_user.email,
        first_name: admin_user.first_name,
        last_name: admin_user.last_name,
        status: admin_user.status,
        last_signed_in_at: admin_user.last_signed_in_at,
        created_at: admin_user.created_at
      }
    end
  end
end
