---
name: local-dev-setup
description: >
  Start, restart, or troubleshoot the local dev stack for this repo (Postgres,
  Redis, Rails API, customer-web, vendor-web, admin-web) and run the e2e
  Playwright suite against it. Use this whenever local servers won't start,
  API requests 500/404 unexpectedly in dev, e2e tests time out or can't reach
  a test-helper endpoint, or the customer-web -> vendor-web handoff link
  breaks locally. Written 2026-08-05 after a session that burned real time
  rediscovering these from scratch.
---

# Local dev setup — your-local-marketplace-core

## The one thing that causes most of the confusing failures

**Rails does not auto-load `.env`.** There is no `dotenv-rails` gem in this
repo's `Gemfile` — only a global `dotenv` CLI is used to load
`apps/api/.env` into the process environment. Any `bin/rails` command that
skips this wrapper silently runs with an empty/default environment and fails
in ways that look unrelated to the real cause (wrong DB port, test-helper
routes 404ing as if disabled, etc.):

```bash
cd apps/api
dotenv bin/rails server -p 3000     # NOT: bin/rails server -p 3000
dotenv bin/rails runner "..."       # NOT: bin/rails runner "..."
dotenv bundle exec rspec            # rspec doesn't need DB port/test-helper
                                     # vars, but use the wrapper by habit
```

If a command that touches the DB or checks `ENV["ENABLE_TEST_HELPERS"]`
behaves oddly, the first thing to check is whether `dotenv` was in front of
it.

## Starting the stack

1. **Postgres + Redis** (docker-compose at repo root):
   ```bash
   docker compose up -d
   docker ps   # confirm: postgres on 0.0.0.0:5432, redis on 0.0.0.0:6379
   ```
   `apps/api/.env`'s `DATABASE_PORT`/`REDIS_URL` must match whatever
   `docker ps` actually shows — they've drifted out of sync before (stale
   values from an old port-collision workaround). If `bin/rails server`
   throws `ActiveRecord::DatabaseConnectionError` immediately on boot, check
   this before anything else.

2. **Rails API** (port 3000):
   ```bash
   cd apps/api && dotenv bin/rails server -p 3000
   ```
   `apps/api/.env` needs `ENABLE_TEST_HELPERS=true` for the e2e suite's
   deterministic-verification-code endpoint to work in development (it's
   always disabled in `test`/`production` regardless of this var — see
   `config/initializers/test_helpers.rb`). Without it, that endpoint 404s
   in a way that looks identical to "route not drawn," not "feature flagged
   off," which wastes time.

3. **Frontends** (each is its own Vite dev server):
   ```bash
   cd apps/customer-web && npm run dev   # :5173
   cd apps/vendor-web && npm run dev     # :5174
   cd apps/admin-web && npm run dev      # (check package.json for port)
   ```
   customer-web needs `VITE_VENDOR_WEB_BASE_URL=http://localhost:5174` to
   cross into vendor-web locally (in production both apps share one origin
   under `/vendor/*`, so this only matters in dev/e2e — see
   `apps/customer-web/src/vendorWeb.ts`). Put this in
   **`apps/customer-web/.env.local`, not `.env`** — Vitest loads `.env` too,
   and unit tests assert against the production-style relative `/vendor`
   default. (Vitest does *not* actually skip `.local` files the way you'd
   expect from Vite's docs — if a test starts asserting on a real
   `localhost:5174` URL instead of the relative default, that's why. The
   real fix already in place: `vite.config.ts`'s `test.env` explicitly pins
   `VITE_VENDOR_WEB_BASE_URL` to `''` for test runs, overriding whatever
   `.env`/`.env.local` say.)

   After changing any `.env`/`.env.local` file, the Vite dev server must be
   restarted — it does not hot-reload env changes.

## Running the e2e suite

```bash
cd e2e   # do this first — do not skip it
npx playwright test
```

Running `npx playwright test` from the repo root (or any other cwd) can
silently pick up spec files from unrelated directories — including stray
background-agent worktrees under `.claude/worktrees/*/e2e/tests/` if any
exist — and fail with confusing "Cannot find package '@playwright/test'" or
"did not expect test() to be called here" errors that have nothing to do
with your actual test code. Always `cd e2e` first; `playwright.config.ts`'s
`testDir` only scopes correctly from there.

## Symptom -> cause quick reference

| Symptom | Likely cause |
|---|---|
| `ActiveRecord::DatabaseConnectionError` on Rails boot | `.env`'s `DATABASE_PORT`/`DATABASE_HOST` doesn't match the actual running Postgres container — check `docker ps` |
| `test_helpers/verification_code` returns 404 | Either `ENABLE_TEST_HELPERS=true` isn't in `.env`, or the server was started without the `dotenv` wrapper so it never saw the var |
| e2e test times out clicking "Start selling" / crossing into vendor-web | `VITE_VENDOR_WEB_BASE_URL` isn't set for customer-web's dev server (or the server wasn't restarted after setting it) — check the URL the test actually navigated to in the trace, not just the timeout message |
| Vitest unit test asserts a real `localhost:5174` URL where it expected a relative `/vendor` path | `.env`/`.env.local` value bled into the test run — should be neutralized by `vite.config.ts`'s `test.env` override; if that's missing, add it rather than removing the dev env var |
| Playwright errors mention `.claude/worktrees/...` or "did not expect test() to be called here" | Ran `npx playwright test` from the wrong directory — `cd e2e` first |
| Clicking "Start selling" (customer-web's become-a-vendor flow) in a real browser silently dumps you on vendor-web's bare `/login` screen instead of the onboarding tour | Expected in local dev, not a bug. `becomeVendor()` already succeeded server-side before the redirect — customer-web then does a full-page nav to `vendor-web`'s `/onboarding`, but its `RequireAuth` guard (`apps/vendor-web/src/App.tsx:17-20`) finds no token, since `localStorage` doesn't cross the :5173/:5174 origin split, and bounces to `/login` with no `return_to`. Production is unaffected — both apps share one origin there, so the token carries over and the tour loads immediately. To keep testing locally: log back in on that screen with the same account, **then manually navigate to `/onboarding`** — vendor-web's `LoginPage` always redirects to `/shops` after login (not back to wherever you came from), so it won't return you to the tour on its own. |
