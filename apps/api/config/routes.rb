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

      # Current user
      get   "me", to: "me#show"
      patch "me", to: "me#update"

      # Verification: one controller, one route per channel. `channel` is baked
      # into each route as a default so the controller stays channel-agnostic.
      %w[email mobile].each do |channel|
        post "verifications/#{channel}",         to: "verifications#create",  defaults: { channel: channel }
        post "verifications/#{channel}/confirm",  to: "verifications#confirm", defaults: { channel: channel }
      end

      # Customer discovery (M2). Authenticated; lists only open shops in the
      # daily-rotating order (ADR 0007), never alphabetical.
      get "shops",              to: "shops#index"
      get "shops/:slug",        to: "shops#show"
      get "shops/:slug/items",  to: "shops#items"
      get "tags",               to: "tags#index"

      # Early-access lead capture (demo demand test). Public, rate-limited.
      post "early_access",      to: "early_access#create"

      # Customer cart, scoped to one shop at a time (ADR 0008). Requires a
      # customer profile; cart-to-order checkout is not built yet (rest of M3).
      get    "cart",             to: "cart#show"
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
      get  "orders",                    to: "orders#index"
      get  "orders/:id",                to: "orders#show"
      post "orders/:id/transitions",    to: "orders#transition"
      post "orders/:id/mark_paid",      to: "orders#mark_paid"
      get  "orders/:id/conversation",   to: "conversations#show"
      post "orders/:id/messages",       to: "conversations#create_message"

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
        delete "shops/:id/photos/:photo_id",  to: "shops#destroy_photo"
        delete "shops/:id/opening_message_photos/:photo_id", to: "shops#destroy_opening_message_photo"

        get    "orders",                      to: "orders#index"

        get    "shops/:shop_id/items",        to: "items#index"
        post   "shops/:shop_id/items",        to: "items#create"
        patch  "items/:id",                   to: "items#update"
        post   "items/:id/enable",            to: "items#enable"
        post   "items/:id/disable",           to: "items#disable"
        delete "items/:id/photos/:photo_id",  to: "items#destroy_photo"
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
  # this — Rack::Static serves them directly first.
  root to: "static#customer_app"
  get "*path", to: "static#customer_app", constraints: ->(req) { !req.path.start_with?("/api") }
end
