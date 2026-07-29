# Sidekiq talks to Redis. REDIS_URL matches docker-compose's redis service by
# default. Active Job routes to Sidekiq in production (see production.rb); dev
# and test use the async/inline adapters so the app boots without Redis.
redis_url = ENV.fetch("REDIS_URL", "redis://127.0.0.1:6379/0")

Sidekiq.configure_server do |config|
  config.redis = { url: redis_url }
end

Sidekiq.configure_client do |config|
  config.redis = { url: redis_url }
end
