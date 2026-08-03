# syntax = docker/dockerfile:1
#
# Build context for this Dockerfile is the REPO ROOT, not apps/api — it needs
# to see apps/customer-web, apps/vendor-web, and apps/admin-web too, since
# this one image now serves all four (API, customer-web at /, vendor-web at
# /vendor/*, admin-web at /admin/*). If deploying with `railway up`, run it
# from the repo root with `--path-as-root . ` and point at this file, not
# `apps/api` as the root.

# ARGs used in a FROM must be declared before the *first* FROM in the file —
# they don't hoist from further down, even for a later stage's own FROM line.
ARG RUBY_VERSION=3.4.5

FROM node:20-slim AS customer-web-build
WORKDIR /build
COPY apps/customer-web/package*.json ./
RUN npm ci
COPY apps/customer-web/ ./
# Same-origin once served by this same Rails app — a relative path, not a
# cross-origin URL. Vite bakes this in at build time.
ENV VITE_API_BASE_URL=/api/v1
# Beta-launch toggle: skip mobile verification during registration while SMS
# delivery is unreliable (Semaphore sender-name approval pending). Remove
# this line (or set to false) to restore the full 3-screen flow.
ENV VITE_SKIP_VERIFICATION=true
RUN npm run build

FROM node:20-slim AS vendor-web-build
WORKDIR /build
COPY apps/vendor-web/package*.json ./
RUN npm ci
COPY apps/vendor-web/ ./
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

FROM node:20-slim AS admin-web-build
WORKDIR /build
COPY apps/admin-web/package*.json ./
RUN npm ci
COPY apps/admin-web/ ./
ENV VITE_API_BASE_URL=/api/v1
RUN npm run build

# Make sure RUBY_VERSION matches the Ruby version in .ruby-version and Gemfile
FROM registry.docker.com/library/ruby:$RUBY_VERSION-slim as base

# Rails app lives here
WORKDIR /rails

# Set production environment
ENV RAILS_ENV="production" \
    BUNDLE_DEPLOYMENT="1" \
    BUNDLE_PATH="/usr/local/bundle" \
    BUNDLE_WITHOUT="development"


# Throw-away build stage to reduce size of final image
FROM base as build

# Install packages needed to build gems
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y build-essential git libpq-dev libvips pkg-config

# Install application gems
COPY apps/api/Gemfile apps/api/Gemfile.lock ./
RUN bundle install && \
    rm -rf ~/.bundle/ "${BUNDLE_PATH}"/ruby/*/cache "${BUNDLE_PATH}"/ruby/*/bundler/gems/*/.git && \
    bundle exec bootsnap precompile --gemfile

# Copy application code
COPY apps/api/ .

# Precompile bootsnap code for faster boot times
RUN bundle exec bootsnap precompile app/ lib/


# Final stage for app image
FROM base

# Install packages needed for deployment
RUN apt-get update -qq && \
    apt-get install --no-install-recommends -y curl libvips postgresql-client && \
    rm -rf /var/lib/apt/lists /var/cache/apt/archives

# Copy built artifacts: gems, application
COPY --from=build /usr/local/bundle /usr/local/bundle
COPY --from=build /rails /rails

# The three SPA builds — customer-web at the public root, vendor-web under
# /vendor/, admin-web under /admin/ (see config/routes.rb +
# app/controllers/static_controller.rb).
COPY --from=customer-web-build /build/dist /rails/public
COPY --from=vendor-web-build /build/dist /rails/public/vendor
COPY --from=admin-web-build /build/dist /rails/public/admin

# Run and own only the runtime files as a non-root user for security
RUN useradd rails --create-home --shell /bin/bash && \
    chown -R rails:rails db log storage tmp
USER rails:rails

# Entrypoint prepares the database.
ENTRYPOINT ["/rails/bin/docker-entrypoint"]

# Start the server by default, this can be overwritten at runtime
EXPOSE 3000
CMD ["./bin/rails", "server"]
