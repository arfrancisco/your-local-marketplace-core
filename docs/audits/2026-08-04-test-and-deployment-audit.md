# Test Suite and Deployment Configuration Audit

**Date:** 2026-08-04
**Commit audited:** `07d8342`
**Companion document:** [`2026-08-04-security-and-architecture-audit.md`](./2026-08-04-security-and-architecture-audit.md) — read that one first if you have not; several findings here explain *why* findings there existed.
**Method:** every suite was **executed**, not just read. Coverage was measured. The API suite was additionally run under three random seeds. See [§9](#9-appendix-how-to-reproduce-all-of-this).

---

## 0. Summary

**The short answer to "do we have good coverage?": the API does, genuinely — 92.41% line coverage and a 448-example suite that passes clean in 27 seconds. The frontends are middling (~70%). The admin console is effectively untested at 17.83% with 2 tests. And the e2e suite, which is what you specifically asked about, is 8 tests covering 3 happy paths, cannot run in CI, and is therefore documentation rather than a safety net.**

The deeper finding is not a number. It is *what* the tests assert. Three of the
highest-severity items in the security audit sit precisely in the gaps this
suite structurally cannot see:

| Security finding | Why the test suite missed it |
|---|---|
| SEC-03 (suspension does not revoke access) | Both halves are tested — "suspended user cannot log in" and "suspend sets the column" — but **the property that spans them is never asserted.** No test asks whether an already-issued token still works. |
| SEC-11 / SEC-03 (WebSocket auth) | `ApplicationCable::Connection` is at **0% coverage**. There is no `spec/channels/` directory. |
| SEC-01 (admin console) | admin-web: **2 tests, 17.83%**. The most privileged surface in the system is the least tested. |

That is the pattern worth taking away: **the suite tests mechanisms
thoroughly and properties barely.** It is very good at "does this endpoint
return the right JSON" and close to silent on "can someone who should not do
this, do this."

On deployment: `railway.json` is 8 lines and configures a builder and nothing
else. No health check, no restart policy. Two findings there are potentially
serious — a `.dockerignore` that is **never applied** because it sits in the
wrong directory (which can bake a developer's local `.env` into the production
image), and a `Procfile` that the Dockerfile builder almost certainly ignores,
which would mean **no Sidekiq worker in production and no background jobs
running at all**. The second needs confirming in the Railway console.

---

## 1. What was run, and what happened

Everything below was executed on 2026-08-04 in this session. Postgres 16 and
Redis 7 were started locally for the API suite. The API was run from a scratch
copy with the Gemfile's `ruby "3.4.5"` pin relaxed to `~> 3.3` (only 3.3.6 was
available in this environment); **no repository files were modified** — `git status` is clean.

| Suite | Result | Time | Files | Tests |
|---|---|---|---|---|
| `apps/api` (RSpec) | ✅ **448 examples, 0 failures** | 27.48s | 62 | 448 |
| `apps/customer-web` (Vitest) | ✅ **66 passed** | 9.20s | 10 | 66 |
| `apps/vendor-web` (Vitest) | ✅ **59 passed** | 7.18s | 11 | 59 |
| `apps/admin-web` (Vitest) | ✅ **2 passed** | 1.65s | 2 | 2 |
| `e2e` (Playwright) | ⚠️ **not run** — requires 4 manually-started servers + seeded DB | — | 3 | 8 |
| **Total** | | **~46s** | **88** | **583** |

**Everything that can run, passes.** No flakes, no failures, no skipped
examples. The API suite additionally passed under `--order random` with seeds
`1234`, `4242`, and `90210` — so despite random ordering being disabled in
config (TEST-08), the suite is order-independent *in fact*.

That speed is worth calling out as a genuine strength: a 27-second backend
suite and sub-10-second frontend suites are fast enough that nobody is
incentivized to skip them. Many projects lose their test discipline to a
20-minute suite. This one has not.

---

## 2. Coverage, measured

**SimpleCov is listed in the Gemfile but never required anywhere** (TEST-01), so
these numbers have never previously existed. I wired it into the scratch copy to
produce them.

### Backend — `apps/api`

```
Line coverage:    1864 / 2017  (92.41%)
Branch coverage:   312 /  396  (78.78%)
Fully covered app files: 91 / 124
```

92.41% line is comfortably above the 80% that most teams treat as the pass mark,
and the 78.78% branch figure is the more honest one — it says roughly one in five
conditional paths is never exercised.

**Where the missing 7.6% lives** (lowest-covered first, `app/` only):

| Coverage | File | What is untested |
|---|---|---|
| **0.0%** | `app/channels/application_cable/connection.rb` | **The entire WebSocket authentication path.** |
| **0.0%** | `app/models/conversation_read.rb` | Whole model. |
| **0.0%** | `app/mailers/application_mailer.rb` | Trivial base class — ignore. |
| **0.0%** | `app/serializers/admin/early_access_signup_serializer.rb` | Whole serializer. |
| **24.1%** | `app/jobs/feedback_notification_job.rb` | `perform` body — the outbound email. |
| **24.1%** | `app/jobs/error_alert_job.rb` | `perform` body — the outbound email. |
| **26.1%** | `app/jobs/verification_delivery_job.rb` | `perform` body — **SMS and email delivery**. |
| **44.4%** | `app/channels/order_chat_channel.rb` | `subscribed` and **`authorized?`** — the chat authorization boundary. |
| 78.4% | `v1/vendor/shops_controller.rb` | Photo-deletion actions. |
| 85.0% | `app/policies/application_policy.rb` | `Scope#resolve` default raise. |
| 85–96% | 11 × `v1/admin/*_controller.rb` | Mostly `show` actions and error branches. |

### Frontend

| App | Statements | Branches | **Functions** | Tests |
|---|---|---|---|---|
| `customer-web` | 68.69% | 75.56% | **51.33%** | 66 |
| `vendor-web` | 72.39% | 77.29% | **54.85%** | 59 |
| `admin-web` | **17.83%** | 62.50% | **13.92%** | **2** |

The **function coverage** column is the one to read. At ~52% for customer-web,
roughly half of all functions — mostly event handlers, error callbacks, and
edge-case branches — are never invoked by any test. Statement coverage flatters
React components because rendering a component marks its whole body covered
without ever clicking anything in it.

**admin-web at 17.83% with 2 tests is the outlier**, and it is the same surface
that SEC-01 identifies as the highest-risk component in the system.

---

## 3. Standards baseline

What "industry standard" means for test suites specifically, and which of these
this project meets.

| Standard / practice | Source | Status |
|---|---|---|
| **Test pyramid** — many unit, fewer integration, fewest e2e | Cohn; Google "Test Sizes" | ⚠️ **Inverted at the top.** 448 API + 127 component, but only 8 e2e — the e2e layer is thinner than the pyramid implies for a 3-client system. |
| **80% line coverage** as a floor, not a target | Google Testing Blog; industry convention | ✅ API (92.4%). ❌ frontends (~70%), ❌ admin-web (17.8%). |
| **Branch coverage** reported alongside line | ASVS V14, most coverage guidance | ❌ Never measured. 78.78% when measured for the first time here. |
| **Coverage enforced in CI**, with a minimum threshold | SSDF PW.7 | ❌ Not measured at all, let alone enforced. |
| **FIRST** (Fast, Independent, Repeatable, Self-validating, Timely) | Beck / Martin | ✅ Fast (46s). ✅ Independent (verified: passes under 3 random seeds). ⚠️ Repeatable — the e2e suite is not (mutable seed data). |
| **Randomized test ordering** to surface order dependence | RSpec default since 3.0 | ❌ **Disabled** — the config block is commented out (TEST-08). |
| **Arrange-Act-Assert**, one behavior per test | xUnit convention | ✅ Consistently followed across RSpec and Vitest. |
| **Test doubles verified against real interfaces** | RSpec `verify_partial_doubles` | ✅ Enabled (`spec_helper.rb:39`). |
| **Factories over fixtures** | factory_bot convention | ✅ FactoryBot, 6 factories, used throughout. |
| **Shared examples for cross-cutting contracts** | RSpec convention | ✅ `admin_auth_shared_examples.rb` is a good example, applied across all admin specs. |
| **User-facing locators in e2e**, not CSS/XPath | Playwright best practices | ⚠️ Mixed — 76 `getByRole`/`getByLabel`/`getByPlaceholder` vs 11 CSS-class selectors, all 11 in one file. |
| **No hard sleeps in e2e** | Playwright docs, explicitly | ❌ One `waitForTimeout(500)`. |
| **e2e retries configured** | Playwright docs (`retries: process.env.CI ? 2 : 0`) | ❌ Not configured. |
| **e2e self-starting via `webServer`** | Playwright docs | ❌ Not configured — 4 manual terminals required. |
| **e2e runs in CI** | Universal | ❌ No workflow runs it. |
| **Cross-browser / mobile-viewport e2e** | Playwright `projects` + `devices` | ❌ No `projects`, no `devices`, no viewport config. Chromium desktop only. |
| **Mutation testing** to validate assertion strength | Mutant / Stryker | ❌ Not present. Reasonable to skip at this stage. |
| **Contract tests** for the API's consumers | Pact / OpenAPI | ❌ None — see ARC-09 in the companion audit. |
| **Accessibility assertions in e2e** | axe-core; WCAG 2.2 | ❌ None. |

**Overall grade: the backend suite meets or exceeds industry standard. The
frontend suites are below it but not alarmingly. The e2e layer and the coverage
tooling are the two places this falls short of what a team would expect.**

---

## 4. Test findings

<a id="test-01"></a>
### TEST-01 — SimpleCov is installed but never runs; coverage has never been measured
**Severity: High**

`Gemfile:48` declares `gem "simplecov", require: false` in the `:test` group. It
is then **never required anywhere** — not in `spec_helper.rb`, not in
`rails_helper.rb`, not in `.rspec`, not in a `.simplecov` file (there is none).
`grep -rn "SimpleCov" spec/ .rspec Rakefile config/` returns nothing.

The gem installs, sits inert, and produces no output. Anyone glancing at the
Gemfile would reasonably conclude coverage is being tracked. It is not, and
never has been — the 92.41% figure in §2 is the first time this number has
existed.

Consequently there is no threshold, no trend, and no way to notice coverage
regressing.

**Remediation** — add to the top of `spec/spec_helper.rb`, before anything else
loads:

```ruby
require 'simplecov'
SimpleCov.start 'rails' do
  enable_coverage :branch
  add_filter '/spec/'
  minimum_coverage line: 90, branch: 75   # current actuals: 92.41 / 78.78
end
```

Setting the floor just below today's actuals locks in the gain without
immediately breaking the build. Add `/coverage` to `apps/api/.gitignore` — it is
not currently ignored, so the first person to run this will otherwise commit the
report.

---

<a id="test-02"></a>
### TEST-02 — The admin console is the most privileged surface and the least tested
**Severity: High** · pairs with SEC-01

```
apps/admin-web:  2 tests,  2 files,  17.83% statements,  13.92% functions
```

Two tests. One asserts the login page renders; one asserts the app renders. For
comparison, `customer-web` has 66 tests and `vendor-web` has 59.

What is untested in admin-web: every one of its **17 page components** —
`UsersPage`, `UserDetailPage`, `OrdersPage`, `OrderDetailPage`,
`ConversationDetailPage`, `ApiTokensPage`, `ErrorLogsPage`, `ShopsPage`,
`AddressesPage`, and the rest. These are the screens that display every user's
home address, every private conversation, and that trigger irreversible actions
(suspend a user, delete a shop, delete an item, revoke a token).

The backend side is better covered — every admin endpoint has at least the
`requires admin basic auth` shared example, and several have more. But the
`admin-web` client that an operator actually drives is essentially unverified,
including its credential-handling code (`api/client.ts`), which SEC-01
identifies as storing the operator password in plaintext `localStorage`.

**Remediation:** at minimum, test the destructive actions — that suspend,
delete-shop, delete-item, and revoke-token each require a confirmation and fire
the right request. Then the credential lifecycle in `auth.tsx` (store on login,
clear on 401, clear on logout). That is perhaps 15 tests for a large reduction
in risk on the highest-consequence surface.

---

<a id="test-03"></a>
### TEST-03 — Both WebSocket authorization boundaries are untested
**Severity: High** · pairs with SEC-03, SEC-11

```
app/channels/application_cable/connection.rb    0.0%   (lines 1,5,6,8,9,12,14,15,16,18,19)
app/channels/order_chat_channel.rb             44.4%   (lines 6,7,9,15,16)
```

There is **no `spec/channels/` directory**. Neither file is exercised by any
test, directly or indirectly.

This matters more than a normal coverage gap. The companion audit's §4.0 notes
that object-level authorization is enforced correctly everywhere — via Pundit
policies or ownership-scoped queries. **The two exceptions are these files.**
`OrderChatChannel#authorized?` (lines 15-16, uncovered) hand-rolls the same
ownership check that `ConversationPolicy` expresses for the REST path, and
`ApplicationCable::Connection#find_verified_user` (uncovered) hand-rolls token
authentication separately from the `Authentication` concern.

So the only two places where the authorization logic is duplicated rather than
shared are also the only two places with no tests. That is exactly how SEC-03
came to exist: the `authenticate!` concern and `find_verified_user` both need a
suspension check, and neither has one, and nothing would have caught it.

**Remediation:** add `spec/channels/`. RSpec supports this natively with
`type: :channel` and `type: :connection`:

```ruby
# spec/channels/application_cable/connection_spec.rb
RSpec.describe ApplicationCable::Connection, type: :channel do
  it "rejects a connection with no token" do
    expect { connect "/cable" }.to have_rejected_connection
  end

  it "rejects a connection with a revoked token" do
    _rec, raw = ApiToken.issue!(user)
    user.api_tokens.update_all(expires_at: 1.minute.ago)
    expect { connect "/cable?token=#{raw}" }.to have_rejected_connection
  end
end

# spec/channels/order_chat_channel_spec.rb — the important one
RSpec.describe OrderChatChannel, type: :channel do
  it "rejects a user who is neither the order's customer nor its vendor" do
    stub_connection current_user: unrelated_user
    subscribe(conversation_id: conversation.id)
    expect(subscription).to be_rejected
  end
end
```

That second spec is the single highest-value test missing from this codebase.

---

<a id="test-04"></a>
### TEST-04 — Tests assert mechanisms, not security properties
**Severity: High** · this is the finding that explains SEC-03

This is a structural observation, not a coverage number, and it is the most
important thing in this document.

Take user suspension. Two tests exist, and both pass:

```ruby
# spec/requests/api/v1/auth_spec.rb:124
it "forbids a suspended account" do
  user.update!(status: "suspended")
  post "/api/v1/auth/login", params: { ... }
  expect(response).to have_http_status(:forbidden)
end

# spec/requests/api/v1/admin/users_spec.rb:25
it "suspends the user" do
  post "/api/v1/admin/users/#{user.id}/suspend", headers: admin_auth_headers
  expect(json.dig("user", "status")).to eq("suspended")
  expect(user.reload.status).to eq("suspended")
end
```

One tests that a suspended user cannot *log in*. The other tests that suspending
*sets the column*. Both are correct. Both pass. And the actual security
property — **"a suspended user cannot use the application"** — is false in
production, because an already-issued bearer token keeps working for up to 30
days (SEC-03).

No test asks the question the property implies:

```ruby
it "rejects an already-issued token after the account is suspended" do
  headers = auth_headers(user)          # token issued while active
  user.update!(status: "suspended")
  get "/api/v1/me", headers: headers
  expect(response).to have_http_status(:unauthorized)   # currently returns 200
end
```

That one test, written at any point, would have caught SEC-03 immediately.

The same shape recurs elsewhere. There are 16 spec files containing
cross-tenant/negative assertions, which is decent, but the suite has:

- **no test that a rate limit ever triggers** (TEST-11),
- **no test that an oversized payload is rejected** (there is no limit — SEC-04),
- **no test that a weak password is rejected** (there is no policy — SEC-05),
- **no test that a non-image file is rejected by content sniffing** (it is not — SEC-08).

In each case the test is absent because the behavior is absent. That is the
trap: a suite that only tests implemented behavior can never tell you what is
missing. Coverage tools cannot see this either — uncovered lines are visible,
unwritten lines are not.

**Remediation:** adopt an explicit **security-properties spec file** —
`spec/requests/security_properties_spec.rb` — that asserts the invariants rather
than the endpoints. Suspension revokes access. Rate limits engage. Oversized
bodies are refused. Cross-tenant IDs 404 on every parameterized route. Tokens
expire. Write them as failing tests first where the behavior does not yet exist;
they become the remediation checklist for the companion audit.

---

<a id="test-05"></a>
### TEST-05 — The e2e suite cannot run in CI, so it gates nothing
**Severity: Medium–High**

`e2e/playwright.config.ts` has **no `webServer` block**. Per `e2e/README.md`,
running the suite requires, by hand:

1. `docker compose up -d db redis`
2. `bin/rails db:seed`, then a Rails server started with **two specific env
   vars** (`ENABLE_TEST_HELPERS=true RACK_ATTACK_ENABLED=false`)
3. `vendor-web` dev server on port 5174
4. `customer-web` dev server on port 5173 with **two more** env overrides
   (`VITE_API_BASE_URL`, `VITE_VENDOR_WEB_BASE_URL`)

Four terminals, six environment variables, and a seeded database. No CI workflow
references `e2e/` at all — `.github/workflows/api-ci.yml` is the only workflow
and it runs `rspec` only.

The consequence: **the e2e suite has never gated a single change.** It is a
manual diagnostic that runs when someone remembers, on a machine configured
just so. Its README is excellent — genuinely one of the better-documented test
setups I have read, including a Troubleshooting section written from real pain.
But documentation of a manual process is not a regression net.

The README's own troubleshooting section is the tell: *"A Rails dev server is
often already running (e.g. left over from manual testing) without
`ENABLE_TEST_HELPERS=true`."* That is a description of a setup too fragile to
rely on.

**Remediation:** add a `webServer` array to `playwright.config.ts` so Playwright
starts all three servers itself:

```ts
webServer: [
  { command: 'cd ../apps/api && ENABLE_TEST_HELPERS=true RACK_ATTACK_ENABLED=false bin/rails server -p 3000',
    url: 'http://localhost:3000/api/v1/health', reuseExistingServer: !process.env.CI, timeout: 120_000 },
  { command: 'cd ../apps/vendor-web && npm run dev -- --port 5174',
    url: 'http://localhost:5174', reuseExistingServer: !process.env.CI },
  { command: 'cd ../apps/customer-web && VITE_API_BASE_URL=http://localhost:3000/api/v1 VITE_VENDOR_WEB_BASE_URL=http://localhost:5174 npm run dev -- --port 5173',
    url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
],
```

Then add a CI job with Postgres and Redis services (the API workflow already has
both — copy that block) that seeds and runs `npx playwright test`. Note this
interacts with the `/api/v1/health` endpoint, which is a good `url` probe since
it also confirms the DB is reachable.

---

<a id="test-06"></a>
### TEST-06 — e2e flakiness is acknowledged but unmanaged
**Severity: Medium**

`playwright.config.ts` sets no `retries`. Playwright's own recommendation is
`retries: process.env.CI ? 2 : 0`. Without it, a single timing blip is a hard
failure with no signal about whether it is real.

That matters here because the suite has **documented, real flakiness history**.
`order-and-chat-flow.spec.ts:90-94`:

> *"Both sides need their ActionCable subscription actually established before
> either sends — a broadcast has no replay, so if the vendor's subscribe call is
> still in flight when the customer sends, the vendor simply never receives that
> message (**this raced and flaked before this wait was added**)."*

The fix applied there is correct (`waitForSelector` on a real element). But four
lines earlier, at line 47:

```ts
await vendor.waitForTimeout(500) // let React StrictMode's double effect-fire settle
```

A hard 500ms sleep. Playwright's documentation is unambiguous: *"Never wait for
timeout in production. Tests that wait for time are inherently flaky."* It is
also the only hard sleep in the whole suite — everything else uses proper
waiting — so this is a single outlier, not a habit.

**Remediation:** set `retries: process.env.CI ? 2 : 0` and `reporter: [['list'], ['html']]`.
Replace the `waitForTimeout` with an assertion on the settled state — most
directly, `await expect(input).toHaveValue(/.+/)` on the field being waited for,
which is what the surrounding `waitForFunction` is already almost doing.

---

<a id="test-07"></a>
### TEST-07 — One e2e spec mutates shared seed data; the other two do not
**Severity: Medium**

`order-and-chat-flow.spec.ts` depends on `db/seeds.rb` — the `Pizza My Heart`
shop, `slice.corner@example.com`, `customer@example.com`, `password123` — and
**mutates it**, overwriting the shop's opening message on every run. It also
creates a new order each run, which accumulates.

The cost is visible in the test itself, at lines 48-54, which is a five-line
comment explaining that `getByLabel('Message')` stops matching *"from the second
run onward, since this reuses the same seeded shop every time."* The test is
working around state left by its own previous execution.

The other two specs are notably better: `registration-and-verification.spec.ts`
and `become-a-vendor.spec.ts` both generate unique emails and mobile numbers per
run (`uniqueEmail()`, `uniqueMobile()`) and depend on no seed data at all. They
are hermetic.

This looks like a chronology rather than a disagreement — the seed-dependent one
appears to be the older spec, and the newer ones adopted a better pattern. Worth
finishing the migration.

**Remediation:** have `order-and-chat-flow.spec.ts` create its own vendor,
shop, item, and customer via the API in a `beforeAll`, the way the other two
specs create their own accounts. This also unblocks `fullyParallel: true` and
`workers > 1`, currently forced to 1 precisely because *"tests share seeded
backend state."*

---

<a id="test-08"></a>
### TEST-08 — RSpec's recommended configuration is entirely commented out
**Severity: Medium**

`spec/spec_helper.rb` is the stock generated file with the recommended block
still wrapped in `=begin` / `=end` (lines ~51-93). Disabled as a result:

| Setting | Effect of it being off |
|---|---|
| `config.order = :random` | **Tests run in declaration order.** Order dependence would never surface. |
| `Kernel.srand config.seed` | No reproducible randomization. |
| `config.disable_monkey_patching!` | Global `describe` still allowed. |
| `config.profile_examples = 10` | No visibility into slow specs. |
| `config.example_status_persistence_file_path` | `--only-failures` / `--next-failure` unavailable. |
| `config.filter_run_when_matching :focus` | `fit`/`fdescribe` do nothing. |

The ordering one is the substantive item. **I tested this directly:** the suite
passes under `--order random` with seeds `1234`, `4242`, and `90210`. So there
is no order dependence today — but nothing would catch one being introduced
tomorrow, which is the entire reason RSpec made random the default in 3.0.

**Remediation:** delete the `=begin`/`=end` markers. Given the suite already
passes randomized, this is a zero-risk change that should be made today. Also
add `--require rails_helper` and `--format documentation` to `.rspec` (currently
only `--require spec_helper`).

---

<a id="test-09"></a>
### TEST-09 — Background jobs are ~25% covered; the delivery paths are untested
**Severity: Medium**

```
app/jobs/verification_delivery_job.rb    26.1%
app/jobs/error_alert_job.rb              24.1%
app/jobs/feedback_notification_job.rb    24.1%
```

There is no `spec/jobs/` directory. The ~25% figure is class and method
*definition* lines; every `perform` body is uncovered. Specs assert that jobs are
**enqueued** (via `ActiveJob::TestHelper`, correctly included in
`rails_helper.rb:63`) and never that they **do the right thing when they run**.

These three jobs are the app's entire outbound communication surface:
`VerificationDeliveryJob` sends the SMS and email verification codes — the ones
that cost real money via Semaphore, and that gate registration and password
reset. The other two are the email amplification path SEC-04 identifies as
abusable.

Untested here: what happens when Semaphore returns a 4xx, when `RESEND_API_KEY`
is blank (the `.env.example` says delivery "just logs the code" — is that
verified?), when the provider times out, whether failures retry, and whether a
retry could double-send a code.

**Remediation:** add `spec/jobs/` with the HTTP calls stubbed. Assert the happy
path, the provider-error path, and the missing-credentials path for each.

---

<a id="test-10"></a>
### TEST-10 — Pundit policies have no direct specs
**Severity: Medium**

No `spec/policies/` directory. `ShopPolicy`, `ItemPolicy`, `OrderPolicy`, and
`ConversationPolicy` are exercised only indirectly, through request specs that
happen to route through them.

Their line coverage is high as a result (92-100%), which is exactly what makes
this easy to miss — the coverage number looks fine. But indirect coverage tests
the *paths the controllers happen to take*, not the policy's own truth table. A
policy is a small pure function of `(user, record) -> boolean`; it is the
cheapest thing in the codebase to test exhaustively and the most expensive to
get wrong.

`OrderPolicy` is the one that matters most: four predicates
(`show?`, `transition?`, `mark_paid?`, `update_items?`) × three actor kinds
(owning customer, owning vendor, unrelated user) is a 12-cell table that should
be asserted directly. Today `mark_paid?` being vendor-only and `update_items?`
being vendor-only rest on request specs remembering to check the customer case.

**Remediation:** add `spec/policies/` with a full permission matrix per policy.
Pundit's own `permissions` matcher makes this compact.

---

<a id="test-11"></a>
### TEST-11 — Rate limiting is untestable by construction
**Severity: Low–Medium** · pairs with SEC-14

There are no tests that any throttle in `rack_attack.rb` ever engages. There
cannot be, as currently configured: `config/environments/test.rb:29` sets
`cache_store = :null_store`, so Rack::Attack's counters never persist and no
throttle can trip.

This is the same knot as SEC-14 in the companion audit — the initializer's
`Rack::Attack.enabled` expression is a no-op that evaluates to `true` in test,
and the only reason specs are not affected is the null cache store. So the
protection is accidental, and the rate limits are simultaneously *always on* and
*impossible to verify*.

That is why SEC-01 (no admin throttle at all) and SEC-06 (no per-account login
throttle) were invisible: there is no test file where their absence would show.

**Remediation:** add `spec/requests/rate_limiting_spec.rb` that swaps in a
`:memory_store` around its examples and asserts each throttle both engages and
returns the documented JSON 429 envelope. Fix SEC-14's parenthesization at the
same time.

---

<a id="test-12"></a>
### TEST-12 — No negative-path or abuse testing
**Severity: Low–Medium**

Absent across the whole suite: oversized payloads, malformed JSON,
wrong `Content-Type`, unicode/emoji in text fields, SQL metacharacters,
concurrent requests (the `Carts::Checkout` oversell race in ARC-08 has no test),
and file uploads that are not actually images.

`spec/models/image_attachable_spec.rb` (6 examples) does test the size and
content-type limits — but by setting the content type, which is precisely the
thing SEC-08 says cannot be trusted. So the test validates the validation as
written rather than the property intended.

**Remediation:** lower priority than TEST-01 through TEST-05. Fold into the
security-properties spec from TEST-04 rather than doing separately.

---

<a id="test-13"></a>
### TEST-13 — Frontend function coverage is ~52%, meaning handlers are largely unexercised
**Severity: Low–Medium**

| App | Statements | Functions | Gap |
|---|---|---|---|
| customer-web | 68.69% | **51.33%** | 17.4 pts |
| vendor-web | 72.39% | **54.85%** | 17.5 pts |

A consistent ~17-point gap between statements and functions in both apps. This
is the signature of tests that **render** components but do not **interact** with
them: mounting a component marks its body covered while leaving every
`onClick`, `onSubmit`, `onError`, and `catch` callback at zero.

The existing tests are not shallow — `ShopDetailPage.test.tsx` (15 tests) and
`CartContext.test.tsx` (11 tests) do real user-event interaction, and the
`LoginPage` registration-flow tests walk all three screens. The gap is
concentrated in error handling and less-common branches.

**Remediation:** prioritize by consequence rather than by percentage. The
uncovered handlers that matter are the ones around checkout, order transitions,
and the `ErrorBoundary` components — a failure there is silent and user-facing.

---

<a id="test-14"></a>
### TEST-14 — No mutation testing, contract tests, accessibility, or performance testing
**Severity: Informational**

None of these are present. My recommendation for each, given the project's
stage:

- **Mutation testing** (Mutant/Stryker) — **skip for now.** Expensive to run and
  to act on; the suite has bigger structural gaps first.
- **Contract tests / OpenAPI** — **do this**, but as ARC-09 in the companion
  audit frames it: the Android client lives in a separate repo and currently has
  no machine-readable contract to build against.
- **Accessibility** (`@axe-core/playwright`) — **worth adding**, cheap. One axe
  scan per e2e page is a few lines and catches the whole category.
- **Performance/load** — **skip.** Premature at pilot scale.

---

## 5. E2E deep dive

You asked about the e2e tests specifically, so here is a fuller assessment than
the findings above.

### Quality: better than most, with one weaker file

The three specs are not perfunctory. They drive **two simultaneous browser
contexts** to verify real ActionCable delivery between a customer and a vendor
without reloading; they fetch **real verification codes** through the
test-helper endpoint rather than stubbing them; they use `expect().toPass()`
polling rather than sleeps; and they are heavily commented with the *reasons*
behind non-obvious waits. The locator strategy is 76 user-facing queries
(`getByRole`, `getByLabel`, `getByPlaceholder`) against 11 CSS-class selectors —
a good ratio, and all 11 of the CSS ones are in a single file.

Quality is not uniform. `registration-and-verification.spec.ts` and
`become-a-vendor.spec.ts` are hermetic, generate unique data per run, and split
into 4 and 3 independent tests respectively. `order-and-chat-flow.spec.ts` is
one 86-line test, depends on mutable seed data, holds the only hard sleep, and
holds all 11 CSS selectors. Bringing that one file up to the standard of the
other two would resolve TEST-06 and TEST-07 together.

### Coverage: 8 tests, 3 happy paths

| Flow | e2e coverage |
|---|---|
| Register → verify mobile → complete profile | ✅ + 3 negative cases |
| Become a vendor → onboarding → first shop | ✅ + eligibility gate + returning-vendor case |
| Cart → checkout → chat → vendor accepts | ✅ (happy path only) |
| **Order cancellation** (customer *and* vendor, with reason codes) | ❌ **none** |
| **Ratings** — the whole M4 rating flow | ❌ **none** |
| **Password reset** end-to-end | ❌ none |
| **Cart edit / remove / clear / one-shop-at-a-time replacement** | ❌ none |
| **Guest-cart merge on login** (ARC-10, non-atomic) | ❌ none |
| **Image upload** — item photos, shop photos, chat images | ❌ none |
| **Order states past `accepted`** (preparing → ready → completed) | ❌ none |
| **Vendor item management** (create/edit/disable/archive) | ❌ none |
| **admin-web** — any flow at all | ❌ none |
| **Error states** — network failure, 500, expired token, offline | ❌ none |

The two most conspicuous absences are **cancellation** and **ratings**. Both are
headline M3/M4 features, both involve state machines with real branching
(`CUSTOMER_CANCELLATION_REASONS` vs `VENDOR_CANCELLATION_REASONS`, the
completed-order gate, the once-per-order uniqueness constraint), and neither has
a single browser-level test.

### The mobile gap

`playwright.config.ts` declares no `projects`, no `devices`, and no `viewport`.
Every test runs in one desktop Chromium at the default 1280×720.

`CLAUDE.md` describes *"several rounds of mobile/UX polish"* as completed work,
and this is a product whose users are neighbors ordering food from their phones
while walking between buildings. **The primary target platform has zero
automated coverage.** Adding it is about six lines:

```ts
projects: [
  { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  { name: 'mobile',  use: { ...devices['Pixel 7'] } },
],
```

Given `workers: 1` and a suite this small, the wall-clock cost is minutes.

### Verdict on the e2e suite

**Well-built, well-documented, and far too small to be a safety net** — and,
because it cannot run in CI, currently providing close to zero regression
protection regardless of its quality. The fix order is: make it runnable in CI
(TEST-05), then add cancellation and ratings, then add the mobile project.

---

## 6. Railway and deployment configuration

You asked for this separately. `railway.json` in full:

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "DOCKERFILE", "dockerfilePath": "apps/api/Dockerfile" }
}
```

Eight lines. It selects a builder and configures nothing else — no health check,
no restart policy, no start command, no replica count, no watch paths.

<a id="rwy-01"></a>
### RWY-01 — `.dockerignore` is in the wrong directory and is never applied
**Severity: High** · CWE-538

`.dockerignore` exists at **`apps/api/.dockerignore`**. There is **no
`.dockerignore` at the repository root**, and the repository root is the build
context — the Dockerfile's own header says so:

> *"Build context for this Dockerfile is the REPO ROOT, not apps/api"*

Docker only reads `.dockerignore` **from the build context root**. A
`.dockerignore` in a subdirectory is inert. So every exclusion in that
carefully-written file — `/.env*`, `/config/master.key`, `/.git/`, `/log/*`,
`/tmp/*`, `/storage/*` — **has no effect whatsoever.**

Two consequences, one of them serious:

**1. A developer's local `.env` can be baked into the production image.**
`Dockerfile:71` is `COPY apps/api/ .` — the entire directory, unfiltered. If a
developer has `apps/api/.env` on disk (and `.env.example` explicitly instructs
"Copy to .env for local overrides"), then `railway up`, which uploads the working
tree, ships that file into the build context, and this `COPY` places it inside
the running production image at `/rails/.env`. The same applies to
`config/master.key`.

This is not hypothetical: `apps/api/.gitignore:28` ignores `/.env`, which means
the file is *expected to exist locally* and is invisible to `git status` — so
nobody would notice. **Git-ignored is not Docker-ignored**, and the file that
was supposed to bridge that gap is in the wrong place.

**2. Build context bloat.** `.git/` (full history), every `node_modules/`, all
build output, and all local logs are uploaded on every deploy.

**Remediation:** move it — `git mv apps/api/.dockerignore .dockerignore` — and
rewrite the paths to be repo-root-relative:

```
.git/
**/node_modules/
**/.env
**/.env.*
!**/.env.example
apps/api/config/master.key
apps/api/log/*
apps/api/tmp/*
apps/api/storage/*
apps/*/dist/
```

Then verify with `docker build` locally and confirm no `.env` lands in the image.
Because this may already have shipped, treat it as another reason to rotate
secrets alongside SEC-00.

---

<a id="rwy-02"></a>
### RWY-02 — No health check configured, despite two health endpoints existing
**Severity: High**

`railway.json` sets no `deploy.healthcheckPath`. Railway therefore considers a
deploy successful as soon as the container starts, and routes production traffic
to it immediately.

The application provides two perfectly good probes that nothing uses:

- `GET /up` — Rails' built-in, returns 200 if boot succeeded (`routes.rb:5`).
- `GET /api/v1/health` — **executes `SELECT 1` against Postgres**, returning 503
  if the database is unreachable (`health_controller.rb`). Its own comment says
  it exists so *"a load balancer can tell 'process is up' from 'process is up but
  can't serve requests'"* — a load balancer that is not configured to ask.

So a deploy that boots with a bad `DATABASE_URL` goes live and serves 500s to
users, and Railway reports it as healthy.

**Remediation:**

```json
"deploy": {
  "healthcheckPath": "/api/v1/health",
  "healthcheckTimeout": 30,
  "restartPolicyType": "ON_FAILURE",
  "restartPolicyMaxRetries": 3
}
```

---

<a id="rwy-03"></a>
### RWY-03 — The Procfile is probably dead config, which would mean no background jobs run at all **[VERIFY]**
**Severity: High if confirmed**

`apps/api/Procfile`:

```
web: bundle exec puma -C config/puma.rb
worker: bundle exec sidekiq -c config/sidekiq.yml
release: bin/rails db:migrate
```

Procfiles are a **Nixpacks/Railpack/Heroku** convention. `railway.json` selects
`"builder": "DOCKERFILE"`, and under the Dockerfile builder Railway runs the
**image's `CMD`** — which is `["./bin/rails", "server"]` (`Dockerfile:106`) — not
the Procfile's process types.

If that is what is happening, then:

- The `worker:` line never starts. **No Sidekiq process exists.** Every
  `perform_later` enqueues into Redis and is never consumed:
  `VerificationDeliveryJob` (SMS and email verification codes),
  `ErrorAlertJob` (the entire error-alerting system from the companion audit's
  ARC-06), and `FeedbackNotificationJob`.
- The `release:` line never runs. Migrations happen instead via
  `bin/docker-entrypoint`, which calls `db:prepare` on server boot — a different
  mechanism with different semantics (see RWY-04).

I cannot resolve this from the repository. Railway service settings can define a
custom start command, and there may be a **second Railway service** running the
worker off the same image. Both are outside the repo.

**Verification:** in the Railway dashboard, check whether a second service
exists with start command `bundle exec sidekiq -c config/sidekiq.yml`. Then, in
production:

```bash
# Are jobs being consumed, or just piling up?
curl -su "$ADMIN_USER:$ADMIN_PASS" https://prisma.kapitmarket.ph/sidekiq/stats
# Or functionally: request a password reset for a test account and see if the
# email actually arrives. If it does not, this finding is confirmed.
```

That second test is the decisive one and takes a minute. **If password-reset
emails are not arriving, this is the cause**, and it also means the beta's
`SKIP_VERIFICATION=true` toggle has been masking a broken delivery pipeline
rather than only working around Semaphore's approval delay.

**Remediation once confirmed:** either add a second Railway service for the
worker pointed at the same image with an explicit start command, or document
clearly that the Procfile is unused and delete the misleading lines.

---

<a id="rwy-04"></a>
### RWY-04 — `db:prepare` on every boot is the wrong migration mechanism for a PaaS
**Severity: Medium**

`bin/docker-entrypoint`:

```bash
if [ "${1}" == "./bin/rails" ] && [ "${2}" == "server" ]; then
  ./bin/rails db:prepare
fi
```

Two problems.

**It races.** Migrations run at *server boot*, not as a separate release step.
With more than one replica — or during a rolling deploy where old and new
containers overlap — multiple processes run migrations against the same database
simultaneously. Rails takes an advisory lock which prevents corruption, but the
losing container blocks on boot and can exceed a startup timeout.

**`db:prepare` fails open.** Unlike `db:migrate`, if the database is empty
`db:prepare` **creates it and loads the schema from scratch**. Against a
misconfigured or wrong `DATABASE_URL`, the intended loud failure becomes a
silently-created empty database — and the app comes up looking healthy with no
data. Combined with RWY-02 (no health check), that state would be served to
users.

**Remediation:** move migrations to a Railway pre-deploy command running
`bin/rails db:migrate`, and reduce the entrypoint to a connectivity check that
aborts if the schema is not already present.

---

<a id="rwy-05"></a>
### RWY-05 — The health endpoint returns raw exception text to unauthenticated callers
**Severity: Low** · CWE-209

`app/controllers/api/v1/health_controller.rb`:

```ruby
rescue StandardError => e
  render json: { status: "error", message: e.message }, status: :service_unavailable
```

`/api/v1/health` is unauthenticated. `PG::ConnectionBad` and
`ActiveRecord::StatementInvalid` messages routinely include the database host,
port, and username — occasionally more. An attacker polling this endpoint during
an incident learns internal infrastructure detail for free.

This also contradicts the deliberate choice made in `ErrorHandling#render_internal_error`,
which suppresses exception text for exactly this reason and says so in a comment:
*"internal exception text can leak schema/config detail."* The health controller
predates or missed that convention.

**Remediation:** log `e.message`, return a fixed string. This is a two-line
change and should be batched with the "do this week" items in the companion
audit.

---

<a id="rwy-06"></a>
### RWY-06 — Connection pool and Sidekiq concurrency are exactly equal, with no headroom
**Severity: Low**

`config/database.yml` sets `pool: RAILS_MAX_THREADS` (default **5**).
`config/sidekiq.yml` sets `:concurrency: 5`.

If the worker runs from this image, it gets 5 job threads against a 5-connection
pool — every thread holding a connection leaves nothing for Sidekiq's own
internals or Active Storage's R2 calls, so jobs intermittently raise
`ActiveRecord::ConnectionTimeoutError` under load. Sidekiq's own guidance is
`pool ≥ concurrency + 2`.

**Remediation:** set `RAILS_MAX_THREADS=7` on the worker service, or set the
pool explicitly higher than concurrency in `database.yml`.

---

<a id="rwy-07"></a>
### RWY-07 — No deploy-time configuration validation
**Severity: Low**

Nothing verifies at boot that required environment variables are present and
sane. Combined with SEC-02's `ENV.fetch(key, "admin")` fallbacks, a
misconfigured deploy comes up *looking* fine while being insecure or
non-functional. `R2_*` blank means image uploads fail at first use, not at boot.
`RESEND_API_KEY` blank means verification silently no-ops.

**Remediation:** a `config/initializers/000_validate_env.rb` that raises in
production if any required variable is missing. Pairs directly with SEC-02's
remediation — do them together.

---

## 7. Prioritized roadmap

Ordered by impact × ease, and merged across both halves of this document.

### This week

| # | Action | Closes |
|---|---|---|
| 1 | Move `.dockerignore` to the repo root; verify no `.env` lands in the image | RWY-01 |
| 2 | **Verify whether Sidekiq runs in production** (request a password reset; see if mail arrives) | RWY-03 |
| 3 | Add `healthcheckPath` + restart policy to `railway.json` | RWY-02 |
| 4 | Wire SimpleCov with `minimum_coverage line: 90, branch: 75`; gitignore `/coverage` | TEST-01 |
| 5 | Delete the `=begin`/`=end` in `spec_helper.rb` (suite already passes randomized) | TEST-08 |
| 6 | Stop returning `e.message` from the health endpoint | RWY-05 |
| 7 | Add the one test that catches SEC-03: suspended user's existing token is rejected | TEST-04 |

### This month

| # | Action | Closes |
|---|---|---|
| 8 | Add `spec/channels/` — connection auth and `OrderChatChannel#authorized?` | TEST-03 |
| 9 | Add `webServer` to `playwright.config.ts` + a CI job that runs e2e | TEST-05 |
| 10 | Add `retries: process.env.CI ? 2 : 0`; remove the `waitForTimeout(500)` | TEST-06 |
| 11 | Add `spec/policies/` with full permission matrices | TEST-10 |
| 12 | Add `spec/jobs/` with providers stubbed | TEST-09 |
| 13 | Frontend + e2e CI jobs (also closes SEC-17 from the companion audit) | TEST-02, SEC-17 |
| 14 | Make `order-and-chat-flow.spec.ts` hermetic; then `workers > 1` | TEST-07 |
| 15 | Move migrations to a pre-deploy step; drop `db:prepare` from the entrypoint | RWY-04 |
| 16 | Boot-time environment validation | RWY-07, SEC-02 |

### Before onboarding real neighbors

| # | Action | Closes |
|---|---|---|
| 17 | e2e for **order cancellation** and **ratings** — headline features, zero coverage | §5 |
| 18 | Add a `mobile` Playwright project — the primary platform is untested | §5 |
| 19 | `spec/requests/security_properties_spec.rb` — invariants, not endpoints | TEST-04, TEST-11, TEST-12 |
| 20 | admin-web tests for destructive actions and credential lifecycle | TEST-02 |

---

## 8. What was not audited

- **The e2e suite was not executed.** It needs four manually-started servers and
  a seeded database (which is TEST-05). Its assessment is from reading the code,
  the config, and the README — not from a run. **I cannot confirm it currently
  passes.** Someone should run it before trusting any of it.
- **Railway service settings were not inspected** — they are outside the
  repository. RWY-03 in particular cannot be resolved without dashboard access,
  and several others (replica count, resource limits, backup configuration,
  actual environment variables) are unverifiable from here.
- **The API suite ran on Ruby 3.3.6, not the pinned 3.4.5.** All 448 examples
  pass on 3.3.6; a version-specific failure on 3.4.5 would not have been caught.
  CI uses the correct version via `.ruby-version`, so this is a limitation of
  this audit only.
- **Coverage was measured once, not tracked.** No trend data exists.
- **Test quality was assessed by reading, not by mutation testing.** High
  coverage with weak assertions is not distinguishable from high coverage with
  strong assertions without it. TEST-04 is the qualitative version of this
  concern; a mutation run would quantify it.
- **No load, soak, or chaos testing.** Concurrency claims (ARC-08's oversell
  race) remain reasoned, not measured.

---

## 9. Appendix: how to reproduce all of this

```bash
# --- Backend suite + coverage ---
cd apps/api
# Add to the TOP of spec/spec_helper.rb first (see TEST-01):
#   require 'simplecov'
#   SimpleCov.start('rails') { enable_coverage :branch; add_filter '/spec/' }
bundle exec rspec
# 2026-08-04: 448 examples, 0 failures, 27.48s
#             Line 1864/2017 (92.41%) · Branch 312/396 (78.78%)

# Order-dependence check (random ordering is disabled in config — TEST-08)
for s in 1234 4242 90210; do bundle exec rspec --order random --seed $s; done
# 2026-08-04: all three green

# Per-file coverage breakdown
ruby -rjson -e '
rs = JSON.parse(File.read("coverage/.resultset.json"))
rs.values.first["coverage"].each do |f, d|
  next unless f.include?("/app/")
  lines = d.is_a?(Hash) ? d["lines"] : d
  rel = lines.compact; next if rel.empty?
  pct = 100.0 * rel.count { |n| n > 0 } / rel.size
  puts format("%-6.1f %s", pct, f.split("/api/").last) if pct < 100
end'

# --- Frontend suites + coverage ---
for app in customer-web vendor-web admin-web; do
  ( cd apps/$app && npm ci && npx vitest run --coverage --coverage.reporter=text-summary )
done
# 2026-08-04: customer 66 tests / 68.69% · vendor 59 / 72.39% · admin 2 / 17.83%

# --- E2E (NOT run in this audit — needs 4 servers, see e2e/README.md) ---
cd e2e && npm ci && npx playwright install chromium && npm test

# --- Railway findings ---
ls -la .dockerignore                      # RWY-01: expect "No such file"
find . -name .dockerignore -not -path "*/node_modules/*"   # only apps/api/
grep -n "healthcheck\|restartPolicy" railway.json || echo "RWY-02: none configured"
grep -n "^CMD" apps/api/Dockerfile        # RWY-03: image CMD vs Procfile
curl -s https://prisma.kapitmarket.ph/api/v1/health   # RWY-05: check for leaked detail
```

---

*Audit performed against commit `07d8342` on 2026-08-04. All suites executed except e2e. Findings are point-in-time; re-verify before acting.*
