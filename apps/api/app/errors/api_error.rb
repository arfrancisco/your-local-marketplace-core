# Base class for domain errors that map cleanly onto an HTTP response. Service
# objects and controllers raise subclasses (or ApiError directly) and the
# ErrorHandling concern renders them in the standard envelope. Anything not
# derived from this is treated as an unexpected 500.
class ApiError < StandardError
  attr_reader :code, :status, :details

  def initialize(message = "Something went wrong", code: "error", status: :internal_server_error, details: nil)
    super(message)
    @code = code
    @status = status
    @details = details
  end

  class Unauthorized < ApiError
    def initialize(message = "Authentication required", details: nil)
      super(message, code: "unauthorized", status: :unauthorized, details: details)
    end
  end

  class Forbidden < ApiError
    def initialize(message = "You are not allowed to do that", details: nil)
      super(message, code: "forbidden", status: :forbidden, details: details)
    end
  end

  class NotFound < ApiError
    def initialize(message = "Not found", details: nil)
      super(message, code: "not_found", status: :not_found, details: details)
    end
  end

  class UnprocessableEntity < ApiError
    def initialize(message = "Validation failed", details: nil)
      super(message, code: "unprocessable_entity", status: :unprocessable_entity, details: details)
    end
  end

  class Conflict < ApiError
    def initialize(message = "Already exists", code: "conflict", details: nil)
      super(message, code: code, status: :conflict, details: details)
    end
  end
end
