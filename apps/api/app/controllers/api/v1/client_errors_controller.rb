module Api
  module V1
    # Frontend crash reporting for customer-web/vendor-web/admin-web error
    # boundaries. Public on purpose: a client that just crashed may have no
    # valid token, or may have crashed before the user ever signed in. When a
    # bearer token happens to be present the report is attributed to that user.
    #
    # This is the browser-side half of our error monitoring — it exists so we
    # do not need a third-party SDK to see frontend errors.
    class ClientErrorsController < BaseController
      skip_before_action :authenticate!
      before_action :authenticate_optionally!

      # Only the three known clients may label themselves; anything else is
      # recorded under a generic tag rather than trusted, since this endpoint
      # is unauthenticated and the body is caller-controlled.
      ALLOWED_SOURCES = %w[customer-web vendor-web admin-web].freeze

      # Stands in for an ActionDispatch request so ErrorLog.record! can read
      # `path`/`request_method` off it uniformly. `path` is the *browser* URL
      # the crash happened on, which is far more useful for a frontend error
      # than this endpoint's own path would be.
      ClientRequest = Struct.new(:path, :request_method)

      # POST /api/v1/client_errors (message, stack, source, url, user_agent)
      def create
        error = ErrorLog::ClientError.new(
          name: client_error_params[:name],
          message: client_error_params[:message],
          backtrace: stack_with_user_agent
        )

        log, newly_created = ErrorLog.record!(
          source: source,
          exception: error,
          request: ClientRequest.new(client_error_params[:url].presence, nil),
          user: current_user
        )

        ErrorAlertJob.perform_later(log.id) if newly_created
        render json: { status: "received" }, status: :created
      end

      private

      # There is no user_agent column (the table is shared with backend errors,
      # which have no such thing), so it rides along as a trailing line on the
      # stored stack — enough to tell "only breaks on old Safari" apart from a
      # universal bug when reading the log later.
      def stack_with_user_agent
        stack = client_error_params[:stack].to_s
        agent = client_error_params[:user_agent].presence
        return stack if agent.nil?

        [stack.presence, "User-Agent: #{agent}"].compact.join("\n")
      end

      def source
        tag = client_error_params[:source].to_s
        ALLOWED_SOURCES.include?(tag) ? tag : "client-unknown"
      end

      def client_error_params
        params.permit(:name, :message, :stack, :source, :url, :user_agent)
      end
    end
  end
end
