# Allow the three web clients (customer-web, vendor-web, admin-web) to call
# the API from the browser. Origins come from ENV as a comma-separated list
# so each environment sets its own; localhost dev ports are allowed by
# default.
Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*ENV.fetch("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:5175").split(","))

    resource "*",
      headers: :any,
      methods: %i[get post patch put delete options head],
      expose: %w[Authorization],
      max_age: 600
  end
end
