require "sidekiq/web"

Rails.application.routes.draw do
  # Boot-level health check (200 if the app booted). Used by the platform.
  get "up" => "rails/health#show", as: :rails_health_check

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
    end
  end

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
end
