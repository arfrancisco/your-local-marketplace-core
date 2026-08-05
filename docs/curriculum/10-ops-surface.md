# Lesson 10 — The operations surface

> Part 10 of 11. Previous: [Chat, payment, and ratings](09-chat-payment-ratings.md) · Next: [Pre-beta review](11-pre-beta-review.md)

## Why this matters

Once the beta is live, this is the lesson you will use daily. A neighbor
reports "the app broke" — what do you actually do? This is the tooling
that answers that, and it is all built in-house on purpose.

## The lesson

### The error contract

Every failure in the API leaves in the same shape:

```json
{ "error": { "code": "...", "message": "...", "details": { } } }
```

Controllers and services **never render errors by hand.** They raise; the
`ErrorHandling` concern maps the exception:

```ruby
rescue_from StandardError, with: :render_internal_error
rescue_from ApiError, with: :render_api_error
rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
rescue_from ActiveRecord::RecordInvalid, with: :render_record_invalid
rescue_from ActionController::ParameterMissing, with: :render_parameter_missing
rescue_from Pundit::NotAuthorizedError, with: :render_forbidden
```

**The ordering is the lesson.** `StandardError` is declared *first*, and the
comment explains why:

```ruby
# StandardError is declared FIRST on purpose. rescue_from matches handlers
# bottom-to-top (ActiveSupport::Rescuable#handler_for_rescue uses
# `reverse_each`), so the *last* matching declaration wins. Putting the
# catch-all at the top means every specific handler below it still takes
# precedence; putting it at the bottom would swallow RecordNotFound,
# NotAuthorizedError and friends and turn each of them into a 500.
```

This inverts the intuition from `rescue` in plain Ruby, where the first
matching clause wins. In `rescue_from`, later declarations take priority, so
the **catch-all goes first**. Get this backwards and every 404 becomes a
500 — a bug that would look baffling without knowing this.

The catch-all handler is careful about what it says:

```ruby
def render_internal_error(error)
  Rails.logger.error("[InternalError] #{error.class}: #{error.message}\n#{...}")
  error_id = record_error_log(error)
  render_error(
    code: "internal_error",
    message: "Something went wrong on our end",
    status: :internal_server_error,
    details: error_id ? { error_id: error_id } : nil
  )
end
```

A **generic** message, because internal exception text can leak schema and
config detail, plus an `error_id` the user can quote to support. The full
detail lives in the `error_logs` row.

And recording must never make things worse:

```ruby
# Recording must never itself take down the response — if the database is
# the thing that is broken, this write fails too, and the caller still
# deserves a well-formed envelope rather than a second exception.
```

So `record_error_log` rescues its own failure and returns nil. The client
still gets a valid envelope, just without a correlation id.

### Error monitoring, in-house

No Sentry, no Rollbar, no SDK. A deliberate call to avoid another paid
service, and the machinery is one model:

```ruby
# One row per distinct error, not per occurrence. Errors repeat — a flaky
# endpoint can throw the same exception hundreds of times an hour — so rows
# are deduped by a `fingerprint` (exception class + message + top backtrace
# line) with a unique index behind it, and repeats just bump
# `occurrences_count`.
```

`ErrorLog.record!` returns `[log, newly_created]`, and the boolean is what
drives alerting: **only a genuinely new fingerprint sends an email.** A
repeating error bumps `occurrences_count` and `last_seen_at` silently.

Two details worth noticing in `record!`:

```ruby
# Explicit type check, not `respond_to?(:name)` — NameError/NoMethodError
# define their own #name (the missing method/constant), so duck-typing here
# would record a NoMethodError as "foo" instead of "NoMethodError".
exception_class = exception.is_a?(ClientError) ? exception.name.to_s : exception.class.name
```

A genuinely subtle bug avoided: `NoMethodError#name` returns the *missing
method's* name. Duck-typing here would have mislabeled every one of them and
fragmented their fingerprints.

And `ErrorLog::ClientError` is a small adapter class letting browser-reported
errors walk the same `record!` path as real server exceptions, so there is
one pipeline rather than two.

### Frontend errors report to the same place

Each SPA has an `ErrorBoundary` plus an `unhandledrejection` listener,
posting to the public `POST /api/v1/client_errors` (public because a crashed
client may have no valid token — lesson 3).

The API client also reports network-level failures, with one exclusion:

```ts
// The one endpoint request() itself must never report failures for —
// reporting a failure of the failure-reporting endpoint would recurse.
const CLIENT_ERROR_REPORT_PATH = '/client_errors'
```

An obvious trap once stated, easy to fall into otherwise.

### Background jobs

Sidekiq on Redis, four jobs: `VerificationDeliveryJob` (email/SMS codes),
`FeedbackNotificationJob`, `ErrorAlertJob`, and the shared `ApplicationJob`.

`ApplicationJob` closes a real gap:

```ruby
# Mirrors ErrorHandling's controller-side capture for background jobs:
# without this, a raising job was only visible via Sidekiq's own retry/dead-set
# UI or STDOUT, never in error_logs/the admin panel. This only *observes* the
# exception — `raise exception` at the end re-raises it immediately, so
# ActiveJob/Sidekiq's own retry/dead-set behavior is completely unaffected; a
# `rescue_from` block that does not re-raise would otherwise swallow it and
# silently break retries.
rescue_from(StandardError) do |exception|
  record_job_error_log(exception)
  raise exception
end
```

**The re-raise is load-bearing.** A `rescue_from` that swallows would turn
every job failure into a silent success and disable Sidekiq's retries. This
observes and re-throws.

`ErrorAlertJob` has its own guard worth knowing:

```ruby
# Operator-awareness email, not something a developer testing locally
# should ever trigger — a real RESEND_API_KEY sitting in a local .env
# must not turn every dev/test exception into a real message to a real inbox.
return unless Rails.env.production?
```

Plus blank-config checks, because "the error alert failed to send" must
never be the loudest failure in the system.

### Rate limiting

Rack::Attack over the Rails cache, disabled in test for determinism
(`RACK_ATTACK_ENABLED`):

| Rule | Limit | Why |
|---|---|---|
| `/api/v1/auth*` POST | 10/min/IP | Credential stuffing |
| `*/verifications*` POST | 5/min/IP | **Codes cost money to send** |
| `*/password_resets*` POST | 5/min/IP | Inbox spam, code brute force |
| `/early_access` POST | 5/min/IP | Public endpoint, abuse target |
| `GET /api/v1/shops*` | 120/min/IP | Public and scrapeable |

Throttled requests get a JSON 429 in the standard envelope with
`Retry-After` — so a rate limit looks like every other error to the client:

```ruby
self.throttled_responder = lambda do |request|
  retry_after = (request.env["rack.attack.match_data"] || {})[:period]
  [429, { "Content-Type" => "application/json", "Retry-After" => retry_after.to_s },
   [{ error: { code: "rate_limited", message: "Too many requests. Try again later." } }.to_json]]
end
```

### Images

Cloudflare R2 via S3-compatible Active Storage (ADR 0006), with limits in
the model layer (lesson 1):

| Attachment | Max |
|---|---|
| Item photos | 3 |
| Shop profile photo | 1 |
| Shop cover photo | 1 |
| Shop opening-message photos | 5 |
| Chat message image | 1 |

Plus JPEG/PNG/WebP only and 5 MB per file, enforced by `ImageAttachable`'s
`has_images` macro. (`docs/erd.md` says 6 item photos — stale.)

### The admin surface, and its four guards

1. **The routes may not exist.** Drawn only when `ADMIN_ENABLED=true` or in
   dev/test. In production without it, a 404 — not a 403.
2. **Per-admin accounts.** `AdminUser` + `AdminApiToken`, re-checked every
   request, so deactivation is immediate (lesson 3).
3. **Every mutation is audited.** One `around_action`, all 16+ controllers,
   recording the status it will actually render (lesson 4).
4. **Sidekiq is separate.** `/sidekiq` has its own
   `SIDEKIQ_WEB_USERNAME`/`PASSWORD` Basic Auth and is not mounted at all
   unless the username is set. Different tool, different audience.

admin-web pages, roughly what you would expect: Users, Vendor profiles,
Shops, Items, Orders, Carts, Conversations, Addresses, Tags, Feedback,
Error logs, Verification challenges, API tokens, Early access signups,
Audit logs, Admin accounts.

Pagination is hand-rolled on the admin base controller — "no pagination gem
in the Gemfile, and admin list sizes don't warrant adding one at this
scale" — with `per_page` clamped to `1..200`.

### admin-mcp: a client, not a backdoor

A small TypeScript MCP server wrapping the admin API as tools (`read.ts` for
lists/shows, `mutate.ts` for state changes). Three properties make it safe:

**No special access.** It authenticates with a bearer `AdminApiToken` over
the same HTTP endpoints admin-web uses. No service-role token, no direct
database connection. Every call is audited under whichever `AdminUser` owns
the token.

**A pre-minted token.** Being a long-running process with no login flow, its
token comes from the `admin_users:mint_token` rake task (180-day default)
rather than the HTTP login endpoint (30 days).

**Confirm-or-dry-run, enforced in code:**

```ts
// Every mutating tool requires confirm:true to actually write — this is a
// code-enforced branch, not just guidance in the description text. With
// confirm omitted/false, the handler performs no request at all and just
// describes what it would have done.
const handler = async (args) => {
  if (args.confirm !== true) {
    return { content: [{ type: 'text', text: `DRY RUN — would ${describeAction(args)}. Get explicit human approval, then re-call with confirm: true.` }] }
  }
  const result = await perform(args)
  ...
}
```

The distinction matters: a description that *says* "be careful" is a
suggestion a model may ignore. A branch that performs no HTTP request unless
`confirm === true` cannot be talked out of. That is the right way to gate an
agent-callable destructive tool.

### Tests

| Suite | Tool | Runs in CI |
|---|---|---|
| API (models, requests, services) | RSpec + FactoryBot + shoulda | **Yes** |
| customer-web / vendor-web / admin-web | Vitest + Testing Library | No |
| End-to-end (3 flows) | Playwright | No |

The e2e flows are order-and-chat, registration-and-verification, and
become-a-vendor. `spec/requests/` is the best available documentation of
the API's real contract — better than any doc in `docs/`.

One test-only route, guarded twice — by env in `routes.rb` and again in an
initializer:

```ruby
# e2e test-helper: never drawn in production, regardless of ENV vars
if Rails.env.test? || Rails.env.development?
  get "test_helpers/verification_code", to: "test_helpers#verification_code"
end
```

Guarded on `Rails.env` rather than an env var so no production misconfig can
expose it. Contrast with `ADMIN_ENABLED`, which *is* an env var because
admin access is legitimately wanted in production.

## Walkthrough: a neighbor says the app broke

1. **Ask for the error id.** The 500 response carried
   `details.error_id`. If they screenshot it, you have an exact row.
2. **Look it up** in admin-web's Error logs, or via admin-mcp. You get
   exception class, message, backtrace, request path and method, the user id
   if any, `occurrences_count`, and first/last seen.
3. **Check the count.** 1 is a one-off; 400 is a live incident that already
   emailed you once, on first sight.
4. **Check `source`.** `backend` is a Rails exception or a job failure;
   client-reported rows come through `POST /client_errors` from an
   `ErrorBoundary` or an unhandled rejection.
5. **Reproduce** using the path and method.
6. **Fix, then deploy** —
   `railway up --service api --path-as-root . --detach` (lesson 2). Nothing
   else deploys.
7. **Resolve the row** (`POST /api/v1/admin/error_logs/:id/resolve`). If the
   fingerprint recurs, `reopen!`.

No error id (say they only described it)? Filter Error logs by time and
path, and cross-reference the audit log if an admin action was involved.

## Common misconceptions

**"`rescue_from` matches top to bottom."** Bottom to top. The catch-all goes
first.

**"One alert per occurrence."** One per *new fingerprint*. Repeats are
silent.

**"A raising job shows up in error logs automatically."** Only because
`ApplicationJob` explicitly captures and re-raises. The re-raise preserves
Sidekiq's retries.

**"Rate limits are on in test."** Off by default, for determinism.

**"admin-mcp has elevated access."** It is an ordinary HTTP client of the
admin API, and its mutations dry-run unless explicitly confirmed.

**"CI runs the e2e suite."** CI runs the API specs only.

**"Sidekiq is behind admin login."** It has its own separate Basic Auth
pair, and is unmounted entirely if unset.

## Exercises

**1.** A junior dev moves `rescue_from StandardError` to the bottom "for
readability." What breaks?

<details><summary>Answer</summary>

Everything specific. Handlers match bottom-to-top, so the last matching
declaration wins — the catch-all at the bottom now beats every handler above
it. `RecordNotFound` returns 500 instead of 404, `Pundit::NotAuthorizedError`
returns 500 instead of 403, validation errors lose their details, and every
one of them gets logged as an unexpected internal error.
</details>

**2.** An error has `occurrences_count: 340` and you received exactly one
email. Working correctly?

<details><summary>Answer</summary>

Yes. `ErrorLog.record!` dedupes by fingerprint and returns
`newly_created: false` for repeats, so `ErrorAlertJob` was enqueued only on
the first occurrence. The other 339 bumped the counter and `last_seen_at`.
</details>

**3.** Why must `ApplicationJob`'s `rescue_from` re-raise?

<details><summary>Answer</summary>

Because a `rescue_from` that returns normally marks the job as *succeeded*.
Sidekiq would never retry it and it would never reach the dead set. The
block only observes — records the error log, enqueues an alert if the
fingerprint is new — and then re-raises so ActiveJob/Sidekiq behave exactly
as they did before the capture existed.
</details>

**4.** Why is the test-helper route guarded on `Rails.env` while the admin
namespace uses an env var?

<details><summary>Answer</summary>

The test helper leaks verification codes and must *never* be reachable in
production — an env var could be set by mistake, `Rails.env.production?`
cannot. The admin API is legitimately wanted in production, just not before
the operator has bootstrapped the first admin, so a deliberate opt-in env
var is the right control there.
</details>

**5.** Why does admin-mcp's `confirm` flag live in a code branch rather than
the tool description?

<details><summary>Answer</summary>

A description is a suggestion a model can ignore, misread, or be talked out
of by injected content. The branch performs no HTTP request at all unless
`confirm === true`, so the guarantee holds regardless of the caller's
reasoning. For destructive, agent-callable tools, that is the difference
between a guardrail and a comment.
</details>

## Recap

- One error envelope for everything; controllers raise, `ErrorHandling`
  maps. **`rescue_from` matches bottom-to-top**, so the catch-all is
  declared first.
- Internal errors return a generic message plus an **`error_id`**; the real
  detail is in `error_logs`, and recording never breaks the response.
- Monitoring is **in-house**: fingerprint dedupe, `occurrences_count`, and
  an email **only on a new fingerprint**. Frontend errors join the same
  pipeline via `POST /client_errors`, which is excluded from self-reporting.
- `ApplicationJob` captures job failures and **re-raises** so Sidekiq's
  retries still work.
- Rate limits protect auth, verification (codes cost money), password
  resets, early access, and discovery, returning a standard 429 envelope.
- The admin surface has **four independent guards**: conditional routes,
  per-admin accounts checked every request, a blanket audit trail, and a
  separately-authenticated Sidekiq dashboard.
- **admin-mcp is an ordinary client** whose mutations dry-run unless
  `confirm: true` — enforced by a branch, not a description.
- CI covers the **API only**; `spec/requests/` is the truest API
  documentation in the repo.

---

Next: [Lesson 11 — Pre-beta review](11-pre-beta-review.md)
