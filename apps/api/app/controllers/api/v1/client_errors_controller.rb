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
      before_action :verify_known_origin

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
        # error_id lets the reporting client's own crash UI display a
        # correlation token ("Error ID: 123") alongside the generic crash
        # message, without leaking anything else about the row.
        render json: { status: "received", error_id: log.id }, status: :created
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

      # Defense in depth, not the real access control (that's the rate limit
      # in config/initializers/rack_attack.rb — this is a public endpoint by
      # design, and Origin/Referer are just headers a non-browser caller can
      # set to anything). This only rejects a request that *claims* an origin
      # clearly outside our own frontends; a request with neither header is
      # let through rather than blocked, since a same-origin production
      # request (all three SPAs are served from the same origin as the API)
      # isn't guaranteed to always send one, and blocking on absence would
      # risk breaking real traffic for no real security gain — a caller
      # willing to spoof this can just omit it too.
      def verify_known_origin
        header = request.headers["Origin"].presence || request.headers["Referer"].presence
        return if header.blank?

        origin = request_origin(header)
        return if origin.nil? || allowed_origins.include?(origin)

        raise ApiError::Forbidden, "Request origin not recognized"
      end

      def request_origin(header)
        uri = URI(header)
        return nil if uri.host.blank?

        port = uri.port unless [80, 443].include?(uri.port)
        "#{uri.scheme}://#{uri.host}#{":#{port}" if port}"
      rescue URI::InvalidURIError
        nil
      end

      def allowed_origins
        ENV.fetch("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175").split(",")
      end
    end
  end
end
