module Admin
  module EarlyAccessSignupSerializer
    module_function

    def call(signup)
      {
        id: signup.id,
        email: signup.email,
        mobile_number: signup.mobile_number,
        name: signup.name,
        interest: signup.interest,
        context: signup.context,
        created_at: signup.created_at
      }
    end
  end
end
