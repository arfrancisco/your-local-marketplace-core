# apps/api — Rails API (core engine)

The single Rails 8.1 API (API-only mode) that serves both web clients and, later,
the Android app. This README covers M0 (foundation). See the repo root `CLAUDE.md`
and `docs/` for product context and decisions.

## Stack

- Ruby 3.4, Rails 8.1 (API mode)
- PostgreSQL (no PostGIS — there is no geo in this product, see ADR 0002)
- Redis + Sidekiq for background jobs (deliberately kept: Rails 8 defaults to
  the Solid stack / Solid Queue, but the plan commits to Sidekiq + Redis, so the
  Solid defaults are not adopted here)
- Active Storage on Cloudflare R2 in production (local disk in dev/test), ADR 0006
- Pundit for authorization, token (bearer) auth
- RSpec + FactoryBot for tests

## Local setup

From the repo root, start Postgres and Redis:

```bash
docker compose up -d
```

Then, in `apps/api`:

```bash
bundle install
bin/rails db:setup   # create + migrate + seed
bin/rails server     # http://localhost:3000
```

Seed accounts (all password `password123`): `customer@example.com`,
`vendor@example.com`, `both@example.com`.

Config defaults (host, port, credentials) match `docker-compose.yml`, so no `.env`
is needed to start. Override anything via environment — see `.env.example`.

## Running tests

```bash
bin/rails db:test:prepare
bundle exec rspec
```

CI runs the same suite on push/PR (`.github/workflows/api-ci.yml`).

## API conventions

- All endpoints are versioned under `/api/v1`.
- Auth: send `Authorization: Bearer <token>`. Register or log in to obtain a token;
  log out to revoke it. Tokens are stored only as digests.
- Errors always return the same envelope:

  ```json
  { "error": { "code": "validation_failed", "message": "Validation failed", "details": { "email": ["is invalid"] } } }
  ```

- Health: `GET /up` (boot check, used by the platform) and `GET /api/v1/health`
  (also checks the database connection).

## M0 endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/v1/auth/register` | no | Create a user (+ customer/vendor profiles) and get a token |
| POST | `/api/v1/auth/login` | no | Exchange email + password for a token |
| POST | `/api/v1/auth/logout` | yes | Revoke the current token |
| GET | `/api/v1/me` | yes | Current user + profiles |
| PATCH | `/api/v1/me` | yes | Update email/mobile/display name |
| POST | `/api/v1/verifications/{email,mobile}` | yes | Send a verification code |
| POST | `/api/v1/verifications/{email,mobile}/confirm` | yes | Confirm a code |
| GET | `/api/v1/health` | no | DB-backed readiness check |

Verification codes are delivered by `VerificationDeliveryJob`, which currently
logs the code (no email/SMS provider is wired up this phase) — that job is the
single seam where a real provider plugs in.

## Layout notes

- Thin controllers; business logic lives in `app/services/` (e.g. `Auth::RegisterUser`,
  `Verifications::ConfirmChallenge`).
- Domain errors subclass `ApiError` (`app/errors/`) and are rendered by the
  `ErrorHandling` concern.
- JSON shaping lives in plain `app/serializers/` modules.
