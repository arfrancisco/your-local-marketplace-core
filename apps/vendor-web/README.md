# apps/vendor-web

Minimal React (Vite + TypeScript) client for vendors to manage their shop and
catalog (M1). It talks to the Rails API in `apps/api`.

## What it does (M1)

- Vendor sign in (token auth against `/auth/login`).
- List your shops; create and edit a shop; open/close it.
- Manage a shop's items: list, add (name, price, tags, photos), enable/disable.
- Photo uploads go straight to the API as multipart; the API enforces the
  ADR 0006 limits (type/size/count).

Scope is deliberately small: this is vendor shop/catalog management only.
Customer discovery, ordering, chat, and ratings are later milestones.

## Setup

```bash
npm install
cp .env.example .env   # optional; defaults to http://localhost:3000/api/v1
npm run dev            # http://localhost:5174
```

Make sure the API is running (`cd ../api && bin/rails server`) with seed data.
Sign in with the seeded vendor account: `vendor@example.com` / `password123`.

## Tests

```bash
npm test
```

Vitest + React Testing Library. Covers the API client (auth header + error
envelope) and the login form.

## Structure

- `src/api/client.ts` — typed fetch wrapper, token storage, error mapping.
- `src/auth.tsx` — auth context (login/logout, session restore on refresh).
- `src/pages/` — Login, Shops list, Shop form, Items management.
- `src/App.tsx` — routing with an auth guard.
