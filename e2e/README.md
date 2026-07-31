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
#    maps them to non-default ports on your machine
cd apps/api
bin/rails db:seed   # only needed once, or after a DB reset
bin/rails server -p 3000

# 3. vendor-web (apps/vendor-web)
cd apps/vendor-web
npm run dev -- --port 5174

# 4. customer-web (apps/customer-web) — override VITE_API_BASE_URL if your
#    apps/customer-web/.env points at a different port than the API above
cd apps/customer-web
VITE_API_BASE_URL=http://localhost:3000/api/v1 npm run dev -- --port 5173
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
