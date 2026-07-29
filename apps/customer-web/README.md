# apps/customer-web

Minimal React (Vite + TypeScript) client for customers to discover shops (M2).
It talks to the Rails API in `apps/api`.

## What it does (M2)

- Register / sign in as a customer (token auth).
- Browse open shops in the community, shown in the API's fair daily rotation
  (ADR 0007), not alphabetical.
- Open a shop to see its details and enabled items.

Discovery only: there is **no cart and no ordering** yet. Placing orders,
chat, and ratings come in later milestones. There is deliberately no map or
distance filter (ADR 0002).

## Setup

```bash
npm install
cp .env.example .env   # optional; defaults to http://localhost:3000/api/v1
npm run dev            # http://localhost:5173
```

Run the API (`cd ../api && bin/rails server`) with seed data first. You can
sign in with the seeded customer (`customer@example.com` / `password123`) or
register a new account.

## Tests

```bash
npm test
```

Vitest + React Testing Library: API client (auth header + error envelope) and
the shops list preserving the server's rotation order.

## Structure

- `src/api/client.ts` — typed fetch wrapper, token storage, error mapping.
- `src/auth.tsx` — auth context (login/register/logout, session restore).
- `src/pages/` — Login, Shops (discovery), Shop detail.
- `src/App.tsx` — routing with an auth guard.
