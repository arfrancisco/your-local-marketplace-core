# End-to-end tests

Full-stack browser tests against real, locally-running servers — not mocked,
unlike the RSpec/vitest suites in `apps/*`. These exist to catch integration
bugs that unit-level tests structurally can't: real login, real WebSocket
chat delivery between two separate browser sessions, real checkout across
the cart -> order -> conversation chain.

## Prerequisites

Before running these, have all of the following up (in separate terminals,
or backgrounded):

```bash
# 1. Postgres + Redis (repo root)
docker compose up -d db redis   # or docker-compose, depending on your install

# 2. Rails API (apps/api) — adjust DB/Redis host:port if docker-compose.yml
#    maps them to non-default ports on your machine.
#    ENABLE_TEST_HELPERS=true is required by registration-and-verification.spec.ts
#    and become-a-vendor.spec.ts (see below) — it turns on a dev/test-only
#    endpoint that hands back a real verification code so those specs don't
#    need a real phone or inbox (see config/initializers/test_helpers.rb;
#    the endpoint's route isn't even drawn in production, regardless of
#    this flag). RACK_ATTACK_ENABLED=false avoids the real per-IP throttle
#    on verification-code requests (5/min) tripping across repeated local
#    runs — those specs send more verification codes per run than
#    order-and-chat-flow.spec.ts ever did.
cd apps/api
bin/rails db:seed   # only needed once, or after a DB reset
ENABLE_TEST_HELPERS=true RACK_ATTACK_ENABLED=false bin/rails server -p 3000

# 3. vendor-web (apps/vendor-web)
cd apps/vendor-web
npm run dev -- --port 5174

# 4. customer-web (apps/customer-web) — override VITE_API_BASE_URL if your
#    apps/customer-web/.env points at a different port than the API above.
#    VITE_VENDOR_WEB_BASE_URL is required by become-a-vendor.spec.ts: in
#    production, customer-web and vendor-web share one origin (vendor-web
#    served under /vendor/*), so the "become a vendor" redirect uses a
#    relative path. Locally the two apps are separate dev-server ports —
#    different origins, where that relative path would just stay on
#    customer-web's own origin. This override points it at vendor-web's
#    real local URL instead (see apps/customer-web/src/pages/AccountPage.tsx).
cd apps/customer-web
VITE_API_BASE_URL=http://localhost:3000/api/v1 \
VITE_VENDOR_WEB_BASE_URL=http://localhost:5174 \
  npm run dev -- --port 5173
```

## Running

```bash
cd e2e
npm install
npx playwright install chromium   # first time only
npm test
```

Override the frontend URLs with `CUSTOMER_WEB_URL` / `VENDOR_WEB_URL` env
vars if you're running against something other than the local default ports.

## What's covered

`tests/order-and-chat-flow.spec.ts` — the full M3/M4 flow: vendor sets a
shop's opening message, a customer checks out from their cart, both sides
see it as a pinned panel above the order's chat (read live off the shop,
not a chat message — ADR 0009, revised), both sides exchange messages in
real time (over the actual ActionCable WebSocket, no reload), the vendor
accepts the order via an explicit status button, and the customer sees the
updated status after a refresh.

This relies on seed data from `apps/api/db/seeds.rb` (specifically the
"Pizza My Heart" shop and its vendor/customer accounts, all password
`password123`) — reseed if that data ever changes shape.

`tests/registration-and-verification.spec.ts` — the full 3-screen
registration flow (register → verify mobile → complete profile): the
required residency-consent checkbox blocking submit until agreed (or the
residency answer changed), mobile verification being skippable while
profile completion never is, and a duplicate-email registration offering
"sign in" / "forgot your password" instead of a raw validation error.
Registers fresh, uniquely-emailed accounts each run — no seed data
dependency.

`tests/become-a-vendor.spec.ts` — the "become a vendor" upgrade: a
resident customer isn't eligible until their email is verified (unlike
mobile, which stays optional for customers), the account page's "Start
selling" action upgrades them and redirects into vendor-web's onboarding
tour, and creating a real first shop there (with the payment/opening-message
callout visible) lands on a fully-usable dashboard. Also confirms a
returning vendor with an existing shop skips onboarding entirely. Note: the
cross-app redirect carries the auth token across manually in this spec
(`crossIntoVendorWeb`) to simulate production's same-origin behavior, since
locally the two apps are genuinely different origins — see the
`VITE_VENDOR_WEB_BASE_URL` note above.
