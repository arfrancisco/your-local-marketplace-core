require "sidekiq/web"

Rails.application.routes.draw do
  # Boot-level health check (200 if the app booted). Used by the platform.
  get "up" => "rails/health#show", as: :rails_health_check

  # Real-time chat delivery (ADR 0009). Connection auth is a bearer token
  # passed as ?token=, since WebSocket connections can't send an
  # Authorization header (see ApplicationCable::Connection).
  mount ActionCable.server => "/cable"

  namespace :api do
    namespace :v1 do
      # Readiness check that also verifies the database connection.
      get "health", to: "health#show"

      # Auth (public)
      post "auth/register", to: "registrations#create"
      post "auth/login",    to: "sessions#create"
      post "auth/logout",   to: "sessions#destroy"

      # Forgot-password flow (public, no session required).
      post "password_resets",         to: "password_resets#create"
      post "password_resets/confirm", to: "password_resets#confirm"

      # Current user
      get   "me", to: "me#show"
      patch "me", to: "me#update"
      post  "me/complete_profile", to: "me#complete_profile"
      post  "me/vendor_profile", to: "me#create_vendor_profile"

      # Verification: one controller, one route per channel. `channel` is baked
      # into each route as a default so the controller stays channel-agnostic.
      %w[email mobile].each do |channel|
        post "verifications/#{channel}",         to: "verifications#create",  defaults: { channel: channel }
        post "verifications/#{channel}/confirm",  to: "verifications#confirm", defaults: { channel: channel }
      end

      # e2e test-helper: never drawn in production, regardless of ENV vars —
      # see config/initializers/test_helpers.rb for the full guard story.
      if Rails.env.test? || Rails.env.development?
        get "test_helpers/verification_code", to: "test_helpers#verification_code"
      end

      # Customer discovery (M2). Authenticated; lists only open shops in the
      # daily-rotating order (ADR 0007), never alphabetical.
      get "shops",              to: "shops#index"
      get "shops/:slug",        to: "shops#show"
      get "shops/:slug/items",  to: "shops#items"
      get "tags",               to: "tags#index"

      # Early-access lead capture (demo demand test). Public, rate-limited.
      post "early_access",      to: "early_access#create"

      # Beta feedback/complaints intake. Public — works signed-in or not.
      post "feedback",          to: "feedback#create"

      # Frontend error reporting (customer-web/vendor-web/admin-web error
      # boundaries). Public — a crashed client may not have a valid token.
      post "client_errors",     to: "client_errors#create"

      # Customer cart, scoped to one shop at a time (ADR 0008). Requires a
      # customer profile. `delete "cart"` clears a whole shop's cart (the
      # frontend's one-shop-at-a-time policy) rather than one line at a time.
      get    "cart",             to: "cart#show"
      delete "cart",             to: "cart#clear"
      post   "cart/items",       to: "cart#add_item"
      patch  "cart/items/:id",   to: "cart#update_item"
      delete "cart/items/:id",   to: "cart#remove_item"
      post   "cart/checkout",    to: "cart#checkout"

      # Orders (M3) + per-order chat (M4). Detail/transition/conversation
      # routes are shared between customer and vendor — OrderPolicy/
      # ConversationPolicy already unify ownership checks for both sides, so
      # one controller pair serves both rather than duplicating one per
      # namespace. List endpoints differ by role and stay separate (see
      # "orders" here for the customer's own orders vs. "vendor/orders"
      # below for a vendor's shop orders).
      get   "orders",                    to: "orders#index"
      get   "orders/:id",                to: "orders#show"
      post  "orders/:id/transitions",    to: "orders#transition"
      post  "orders/:id/mark_paid",      to: "orders#mark_paid"
      # Vendor edits an in-progress order's line items (swap a sold-out
      # item, adjust quantity) after telling the customer via chat first —
      # no formal approval gate (see Orders::EditItems).
      patch "orders/:id/items",         to: "orders#update_items"
      get   "orders/:id/conversation",   to: "conversations#show"
      post  "orders/:id/messages",       to: "conversations#create_message"

      # Ratings (M4) — customer rates the shop once an order is completed,
      # once per completed order (see Ratings::Create for the actual gate).
      post "orders/:id/ratings",        to: "ratings#create"

      # Public reviews list for a shop's page — same auth shape as the
      # other shops#* discovery actions above.
      get "shops/:slug/ratings",        to: "shops#ratings"

      # Current user's saved addresses (descriptive, not geo).
      get    "addresses",      to: "addresses#index"
      post   "addresses",      to: "addresses#create"
      patch  "addresses/:id",  to: "addresses#update"
      delete "addresses/:id",  to: "addresses#destroy"

      # Vendor shop + catalog management (M1). All require a vendor profile.
      namespace :vendor do
        get    "shops",                       to: "shops#index"
        post   "shops",                       to: "shops#create"
        get    "shops/:id",                   to: "shops#show"
        patch  "shops/:id",                   to: "shops#update"
        post   "shops/:id/open",              to: "shops#open"
        post   "shops/:id/close",             to: "shops#close"
        delete "shops/:id/profile_photo", to: "shops#destroy_profile_photo"
        delete "shops/:id/cover_photo",   to: "shops#destroy_cover_photo"
        delete "shops/:id/opening_message_photos/:photo_id", to: "shops#destroy_opening_message_photo"

        get    "orders",                      to: "orders#index"

        get    "shops/:shop_id/items",        to: "items#index"
        post   "shops/:shop_id/items",        to: "items#create"
        patch  "items/:id",                   to: "items#update"
        post   "items/:id/enable",            to: "items#enable"
        post   "items/:id/disable",           to: "items#disable"
        delete "items/:id/photos/:photo_id",  to: "items#destroy_photo"

        # Private notes a vendor keeps about a specific customer — never
        # visible to the customer or to any other vendor (see
        # Api::V1::Vendor::CustomerNotesController).
        get    "customer_notes",     to: "customer_notes#index"
        post   "customer_notes",     to: "customer_notes#create"
        patch  "customer_notes/:id", to: "customer_notes#update"
        delete "customer_notes/:id", to: "customer_notes#destroy"
      end

      # Internal admin surface: one shared Basic-Auth credential
      # (ADMIN_USERNAME/PASSWORD), not a User role — see
      # Api::V1::Admin::BaseController. Guarded the same way as Sidekiq::Web
      # below: only drawn if credentials are actually configured (or in
      # dev/test, so specs can hit it without the env var set), so
      # production never silently ships with an admin/admin fallback
      # reachable before the operator actually sets real credentials.
      if Rails.env.local? || ENV["ADMIN_USERNAME"].present?
        namespace :admin do
          get   "users",                to: "users#index"
          get   "users/:id",            to: "users#show"
          post  "users/:id/suspend",    to: "users#suspend"
          post  "users/:id/reactivate", to: "users#reactivate"

          get   "vendor_profiles",             to: "vendor_profiles#index"
          get   "vendor_profiles/:id",         to: "vendor_profiles#show"
          post  "vendor_profiles/:id/approve", to: "vendor_profiles#approve"
          post  "vendor_profiles/:id/reject",  to: "vendor_profiles#reject"

          get    "shops",     to: "shops#index"
          get    "shops/:id", to: "shops#show"
          patch  "shops/:id", to: "shops#update"
          delete "shops/:id", to: "shops#destroy"

          get    "items",     to: "items#index"
          get    "items/:id", to: "items#show"
          patch  "items/:id", to: "items#update"
          delete "items/:id", to: "items#destroy"

          get  "orders",                 to: "orders#index"
          get  "orders/:id",             to: "orders#show"
          post "orders/:id/transitions", to: "orders#transition"

          get  "feedback_submissions",             to: "feedback_submissions#index"
          get  "feedback_submissions/:id",         to: "feedback_submissions#show"
          post "feedback_submissions/:id/resolve", to: "feedback_submissions#resolve"
          post "feedback_submissions/:id/reopen",  to: "feedback_submissions#reopen"

          get    "api_tokens",     to: "api_tokens#index"
          get    "api_tokens/:id", to: "api_tokens#show"
          delete "api_tokens/:id", to: "api_tokens#destroy" # soft-revoke

          get "verification_challenges",     to: "verification_challenges#index"
          get "verification_challenges/:id", to: "verification_challenges#show"
          get "order_status_events",         to: "order_status_events#index"
          get "order_status_events/:id",     to: "order_status_events#show"
          get "conversations/:id",           to: "conversations#show"

          get "customer_profiles",     to: "customer_profiles#index"
          get "customer_profiles/:id", to: "customer_profiles#show"
          get "addresses",             to: "addresses#index"
          get "addresses/:id",         to: "addresses#show"
          get "carts",                 to: "carts#index"
          get "carts/:id",             to: "carts#show"

          get    "tags",     to: "tags#index"
          delete "tags/:id", to: "tags#destroy"

          get    "early_access_signups",     to: "early_access_signups#index"
          delete "early_access_signups/:id", to: "early_access_signups#destroy"

          get "vendor_customer_notes",     to: "vendor_customer_notes#index"
          get "vendor_customer_notes/:id", to: "vendor_customer_notes#show"

          get  "error_logs",             to: "error_logs#index"
          get  "error_logs/:id",         to: "error_logs#show"
          post "error_logs/:id/resolve", to: "error_logs#resolve"
          post "error_logs/:id/reopen",  to: "error_logs#reopen"
        end
      end
    end
  end

  # vendor-web, served under /vendor/* on the same domain as customer-web
  # (see apps/vendor-web/vite.config.ts's base path + Rails.root/public/vendor,
  # populated by building vendor-web and copying its dist/ output there).
  # Real static files (JS/CSS under /vendor/assets/*) never reach this route —
  # Rack::Static serves them directly first. This only ever catches client-
  # side route paths (e.g. /vendor/shops), which need the same index.html so
  # React Router can take over.
  get "vendor", to: "static#vendor_app"
  get "vendor/*path", to: "static#vendor_app"

  # admin-web, same mechanism as vendor-web above — served under /admin/*.
  # Its own API surface (Api::V1::Admin::*) is Basic-Auth gated, not this
  # static shell; the shell itself is just the SPA's index.html.
  get "admin", to: "static#admin_app"
  get "admin/*path", to: "static#admin_app"

  # Sidekiq's dashboard. Guarded so it is never publicly reachable; in
  # production, SIDEKIQ_WEB_USERNAME/PASSWORD must be set to mount it.
  if Rails.env.development? || ENV["SIDEKIQ_WEB_USERNAME"].present?
    Sidekiq::Web.use(Rack::Auth::Basic) do |username, password|
      expected_user = ENV.fetch("SIDEKIQ_WEB_USERNAME", "admin")
      expected_pass = ENV.fetch("SIDEKIQ_WEB_PASSWORD", "admin")
      ActiveSupport::SecurityUtils.secure_compare(username, expected_user) &
        ActiveSupport::SecurityUtils.secure_compare(password, expected_pass)
    end unless Rails.env.development?
    mount Sidekiq::Web => "/sidekiq"
  end

  # customer-web, served at the domain root (same api service as vendor-web
  # above — one deployed service serves both frontends + the API). Must stay
  # the LAST route drawn: it's a catch-all, everything above takes priority.
  # Real static files (JS/CSS under /assets/*, favicon.svg, etc.) never reach
  # this — Rack::Static serves them directly first. Engine-mounted routes
  # (ActiveStorage's /rails/active_storage/*, ActionCable's /cable, the
  # health check, Sidekiq) are appended by Rails *after* this file's own
  # routes, so without these exclusions this catch-all would shadow all of
  # them — exactly what broke image loading in production the first time.
  RESERVED_PATH_PREFIXES = %w[/api /rails /cable /up /sidekiq].freeze
  root to: "static#customer_app"
  get "*path", to: "static#customer_app",
      constraints: ->(req) { RESERVED_PATH_PREFIXES.none? { |prefix| req.path.start_with?(prefix) } }
end
