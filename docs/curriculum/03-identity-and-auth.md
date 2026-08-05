# Lesson 3 — Who you are: identity and authentication

> Part 3 of 11. Previous: [How the system is shaped and shipped](02-shape-and-shipping.md) · Next: [Authorization](04-authorization.md)

## Why this matters

There are **two completely separate authentication systems** in this
codebase that look similar and share no code. Confusing them will send you
looking for a bug in the wrong file. And the identity model — capability-
based rather than role-based — is the reason a single person can be both a
customer and a vendor without any of the awkwardness that usually implies.

This lesson is about *who you are*. The next one is about *what you may do*.
Keep them separate in your head; the codebase does.

## The lesson

### Identity: capabilities, not roles

There is no `role` column anywhere. There is a `users` table, and hanging
off it optionally:

- a `customer_profile`
- a `vendor_profile`

A user may have neither, either, or **both at once**. "Being a vendor" means
`user.vendor_profile.present?`, not `user.role == "vendor"`.

This is not a stylistic choice. In this product, a neighbor who sells
pandesal in the morning is also a neighbor who buys ulam in the evening.
Modelling that as mutually exclusive roles would force two accounts for one
person.

The consequence you will actually notice: **signing in on customer-web signs
you in on vendor-web too.** Both SPAs read the same localStorage key, and
since ADR 0001's one-service design they are same-origin, so the key is
genuinely shared:

```ts
// Shared with vendor-web's key — both apps are same-origin now (customer at
// /, vendor at /vendor), and a User can hold both a customer_profile and a
// vendor_profile at once (capability-based, not a role column). Signing in
// on either app signs you in on both, rather than needing two logins for
// one identity.
const TOKEN_KEY = 'kapitmarket_token'
```

admin-web deliberately uses a *different* key, `kapitmarket_admin_token`, so
the two sessions never mix.

Becoming a vendor is an upgrade on an existing account, not a new signup —
`Vendors::Upgrade` runs an eligibility check and then calls
`create_vendor_profile!` on the user you already are.

### Authentication world 1: marketplace users

The scheme is bearer tokens. `ApiToken` is worth reading in full because
it is small and every decision in it is deliberate:

```ruby
class ApiToken < ApplicationRecord
  belongs_to :user
  TTL = 30.days

  scope :active, -> { where("expires_at IS NULL OR expires_at > ?", Time.current) }

  def self.issue!(user)
    raw = SecureRandom.urlsafe_base64(32)
    record = create!(user: user, token_digest: digest(raw), expires_at: TTL.from_now)
    [record, raw]
  end

  def self.authenticate(raw)
    return nil if raw.blank?
    active.find_by(token_digest: digest(raw))
  end

  def self.digest(raw) = Digest::SHA256.hexdigest(raw)
end
```

Three things to take from it:

1. **The plaintext token is returned exactly once, at issue, and never
   stored.** Only the SHA-256 digest lives in the database.
2. **SHA-256, not BCrypt** — and the code explains why: "High-entropy random
   tokens don't need BCrypt — SHA-256 keeps per-request auth lookups fast
   while still being useless if the DB leaks." BCrypt's slowness exists to
   defend low-entropy human passwords against brute force. A 32-byte random
   token has nothing to brute-force.
3. **Lookup is by digest**, so `authenticate` is a single indexed query.

The controller side is the `Authentication` concern:

```ruby
def authenticate!
  token = ApiToken.authenticate(bearer_token)
  raise ApiError::Unauthorized if token.nil?

  token.touch_usage!
  @current_api_token = token
  @current_user = token.user
end

def bearer_token
  header = request.authorization.to_s
  header[/\ABearer (.+)\z/, 1]
end
```

`Api::V1::BaseController` requires it for everything by default:

```ruby
class BaseController < ApplicationController
  before_action :authenticate!
end
```

**Public endpoints opt out explicitly** with `skip_before_action
:authenticate!`. That is the right default — forgetting to add auth is a
security bug, forgetting to remove it is a visible 401.

There is a second variant for endpoints that must serve both signed-in and
anonymous callers:

```ruby
def authenticate_optionally!
  token = ApiToken.authenticate(bearer_token)
  return if token.nil?
  ...
end
```

Only two things use it, and both for the same reason — they have to work
when the caller may have no session at all: **feedback submission** and
**client error reporting**. A crashed frontend reporting its own crash
cannot be required to hold a valid token.

### Which endpoints are public

Worth committing to memory, because it is a smaller list than you would
guess and one entry is a documentation drift:

- `POST /auth/register`, `/auth/login`, `/auth/logout`
- `POST /password_resets`, `/password_resets/confirm`
- `POST /early_access`, `/feedback`, `/client_errors`
- **All of discovery**: `GET /shops`, `/shops/:slug`, `/shops/:slug/items`,
  `/shops/:slug/ratings`, `/tags`

That last group surprises people because `routes.rb` comments it as
"Authenticated." It is not — `ShopsController` opens with
`skip_before_action :authenticate!`, and the class comment explains the
intent:

```ruby
# Public (no login) so people can browse the community as a hook before
# signing up. It is still not a public search index — there is no
# geo/distance discovery (ADR 0002).
```

The code is right and the route comment is stale. This matters practically:
anonymous browsing is why the guest cart exists (lesson 7).

### WebSockets: same token, different door

ActionCable cannot send an `Authorization` header during the WebSocket
handshake. So the same bearer token rides in as a query param:

```ruby
class Connection < ActionCable::Connection::Base
  identified_by :current_user

  def connect
    self.current_user = find_verified_user
  end

  private

  def find_verified_user
    token = ApiToken.authenticate(request.params[:token])
    reject_unauthorized_connection if token.nil?

    token.touch_usage!
    token.user
  end
end
```

Same `ApiToken.authenticate`, same digest lookup, same user. Only the
transport differs. Connecting looks like
`wss://host/cable?token=<raw-token>`.

### Authentication world 2: admins

Completely separate. Different tables, different models, different
controller base, no shared code:

| | Marketplace user | Admin |
|---|---|---|
| Identity | `User` | `AdminUser` (`has_secure_password`) |
| Token | `ApiToken` | `AdminApiToken` |
| Concern | `Authentication` | `Admin::Authentication` |
| Base controller | `Api::V1::BaseController` | `Api::V1::Admin::BaseController` → `ApplicationController` |
| localStorage key | `kapitmarket_token` | `kapitmarket_admin_token` |
| Token TTL | 30 days | 30 days (180 for pre-minted MCP tokens) |

`AdminUser`/`AdminApiToken` are not the same rows as `User`/`ApiToken`, not
a polymorphic extension of them, and not a role flag on them. ADR 0010
argues this deliberately: admin identity is *architecturally* separate from
marketplace-user identity. It mirrors the pattern rather than reusing the
code, matching this repo's stated preference for duplication over
cross-cutting shared abstractions.

Note that `Api::V1::Admin::BaseController` inherits `ApplicationController`
**directly**, skipping `Api::V1::BaseController`. Bearer-token auth for
marketplace users and bearer-token auth for admins never overlap on the same
request, so there is nothing to share.

Two properties of the admin system worth knowing cold:

**Revocation is immediate.** The admin token is resolved and the admin's
status re-checked on **every request**, not cached into a session. Deactivate
an admin at 2:00 pm and they are locked out at 2:00 pm, not at their next
login. Deactivation also expires their live tokens.

**The routes may not exist at all.** The whole admin namespace is only drawn
when `ADMIN_ENABLED=true` (or in dev/test):

```ruby
if Rails.env.local? || ENV["ADMIN_ENABLED"] == "true"
  namespace :admin do
    ...
  end
end
```

In production without that env var, `/api/v1/admin/users` is a 404 — not a
403. The surface is absent, not merely guarded.

**Bootstrapping:** the first `AdminUser` comes from the `admin_users:create`
rake task, which aborts if any admin already exists. Every admin after that
is created self-service from admin-web's Admin accounts page. An admin
cannot deactivate their own account — a self-lockout guard.

(One stale comment to ignore: `StaticController` still says admin-web logs
in with HTTP Basic. That was true before ADR 0010; it is bearer tokens now.)

### Verification: email and SMS

`verification_challenges` stores a `code_digest` — never the plaintext code
— plus `channel` (email/sms), `purpose`, `sent_to`, `expires_at`,
`consumed_at`, and `attempts_count`.

The routes are generated per channel with the channel baked in as a
default, so the controller never branches on it:

```ruby
%w[email mobile].each do |channel|
  post "verifications/#{channel}",        to: "verifications#create",  defaults: { channel: channel }
  post "verifications/#{channel}/confirm", to: "verifications#confirm", defaults: { channel: channel }
end
```

Delivery is real, not stubbed: Resend / Cloudflare Email Service for email,
Semaphore for SMS, dispatched through `VerificationDeliveryJob` on Sidekiq.

**Both are currently switched off for the beta** via `SKIP_VERIFICATION`
and `VITE_SKIP_VERIFICATION`, pending Semaphore's sender-name approval. That
is lesson 11 material, but note it here because it changes who can place an
order: `Carts::Checkout`'s very first gate is an email-verified check.

## Walkthrough: a token's life

1. **Register.** `POST /api/v1/auth/register` → `Auth::RegisterUser` creates
   the `User` and a `customer_profile`. `ApiToken.issue!` mints
   `SecureRandom.urlsafe_base64(32)`, stores only its SHA-256 digest with a
   30-day expiry, and returns the plaintext once.
2. **Store.** customer-web writes it to `localStorage['kapitmarket_token']`.
3. **Use.** Every request adds `Authorization: Bearer <token>`.
   `authenticate!` extracts it with `/\ABearer (.+)\z/`, hashes it, finds
   the active `ApiToken` by digest, stamps `last_used_at`, and sets
   `current_user`.
4. **Upgrade.** The user taps "become a vendor". `Vendors::Upgrade` runs
   `EligibilityCheck`, then `create_vendor_profile!`. **The token does not
   change.** The same token now carries vendor capability, because
   capability is derived from the user's profiles, not baked into the token.
5. **Open vendor-web.** Same origin, same localStorage key, already signed
   in. No second login.
6. **Open an order chat.** The client opens `wss://host/cable?token=<same
   token>`. `ApplicationCable::Connection` resolves it through the same
   `ApiToken.authenticate`.
7. **Expire.** After 30 days the `active` scope stops matching,
   `authenticate` returns nil, and the next request is a 401.

## Common misconceptions

**"There's a role column."** There is not. Capability comes from the
presence of `customer_profile` / `vendor_profile`.

**"Admins are users with a flag."** They are a separate model set with no
relationship to `User` at all.

**"Discovery requires login."** It does not. `ShopsController` skips
authentication; the route comment saying otherwise is stale.

**"Tokens are stored so we can show them again."** Only the digest is
stored. A lost token cannot be recovered, only reissued.

**"Deactivating an admin takes effect at their next login."** Immediately,
on their very next request.

**"The admin API is protected by a 403."** In production without
`ADMIN_ENABLED`, it is a 404 — the routes were never drawn.

## Exercises

**1.** A user registers, then becomes a vendor. How many `User` rows,
`ApiToken` rows, and logins are involved?

<details><summary>Answer</summary>

One `User` row (now holding both a `customer_profile` and a
`vendor_profile`), one `ApiToken`, one login. `Vendors::Upgrade` adds a
profile to the existing user; nothing about the token changes, because
capability is read off the user's profiles per request.
</details>

**2.** Why SHA-256 for API tokens when passwords use BCrypt?

<details><summary>Answer</summary>

BCrypt is deliberately slow to defend low-entropy human passwords against
brute force. An API token is 32 bytes of `SecureRandom` — there is nothing
to brute-force. SHA-256 keeps the per-request lookup fast while still
making a database leak useless, since the plaintext is never stored.
</details>

**3.** Your WebSocket connection is rejected while REST calls with the same
token succeed. Where do you look?

<details><summary>Answer</summary>

At how the client builds the socket URL. The token must be a `?token=`
query param, since the handshake cannot carry an `Authorization` header.
`ApplicationCable::Connection` reads `request.params[:token]` and calls
`reject_unauthorized_connection` when it resolves to nil — most often the
param is missing, empty, or URL-encoding got mangled.
</details>

**4.** Which two endpoints use `authenticate_optionally!`, and what breaks
if you switch them to `authenticate!`?

<details><summary>Answer</summary>

`POST /feedback` and `POST /client_errors`. Requiring a token would mean
anonymous visitors could not send feedback, and — worse — a frontend that
crashed before or during login could not report its own crash, which is
exactly when you most want the report.
</details>

**5.** In production, `GET /api/v1/admin/users` returns 404 with a valid
admin token. What is the most likely cause?

<details><summary>Answer</summary>

`ADMIN_ENABLED` is not set to `"true"` on the service, so the entire admin
namespace was never drawn into the route table. A 403 would mean the route
exists and auth failed; a 404 means the route does not exist.
</details>

## Recap

- Identity is **capability-based**: one `User`, optional `customer_profile`
  and/or `vendor_profile`, no role column. Customer-web and vendor-web share
  one token and one login.
- `ApiToken` stores only a **SHA-256 digest**, returns plaintext once, and
  expires in 30 days. SHA-256 because high-entropy tokens do not need
  BCrypt's slowness.
- Authentication is **required by default** (`BaseController`); public
  endpoints skip it explicitly. Discovery is genuinely public despite the
  stale route comment.
- `authenticate_optionally!` exists for exactly two endpoints — feedback and
  client errors — which must work for anonymous or crashed clients.
- **ActionCable** uses the same token as a `?token=` query param, since
  WebSocket handshakes cannot carry headers.
- **Admins are a separate world**: `AdminUser` + `AdminApiToken`, checked on
  every request (so revocation is instant), and the whole namespace only
  exists when `ADMIN_ENABLED=true`.

---

Next: [Lesson 4 — What you're allowed to do: authorization](04-authorization.md)
