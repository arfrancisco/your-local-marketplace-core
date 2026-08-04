# Security and Architecture Audit

**Date:** 2026-08-04
**Commit audited:** `07d8342`
**Scope:** `apps/api`, `apps/customer-web`, `apps/vendor-web`, `apps/admin-web`, `admin-mcp`, `.github/workflows`, `docs/`
**Method:** static review of the checked-in source, plus dependency scans (`bundler-audit`, `npm audit`) executed 2026-08-04. No dynamic testing, no running instance, no cloud-console review. See [What was not audited](#what-was-not-audited).

> **⚠️ Read [SEC-00](#sec-00) first.** The dependency scan found an actively
> exploitable **CVSS 9.5 unauthenticated RCE** in the pinned Rails version. This
> application meets every precondition. It outranks everything else in this
> document. There is a one-line mitigation that ships today.

---

## 0. How to use this document (read this first, agent)

This is a handoff artifact. It is written to be actionable without re-reading the
whole codebase, but **not** to be trusted blindly.

- Every finding carries a **file:line evidence pointer**. Open it before acting.
  Line numbers are accurate as of `07d8342` and will drift.
- Findings marked **[VERIFY]** are ones I could not confirm statically. Do not
  report them as fixed or as real until you have run the check named in the
  finding.
- Severity is calibrated to **this app at pilot scale** (one building cluster,
  tens of vendors, no payment gateway, no card data), not to a generic
  enterprise threat model. A "Critical" here means "would plausibly be exploited
  in the first months of a real pilot, with real consequences for real
  neighbors."
- The remediation roadmap in §6 is ordered by (impact × ease). If you are
  implementing rather than reviewing, **start there, not at finding SEC-01.**
- Do not treat this document as a spec. Several findings have more than one
  reasonable fix; where that is true I say so. Pick one and record it as an ADR
  in `docs/adr/`, consistent with this project's existing convention.

**One-paragraph summary for a human:** the single most urgent item is not
application code at all — it is a six-day-old **CVSS 9.5 unauthenticated RCE in
the pinned Rails version** ([SEC-00](#sec-00)) that this app is fully exposed to,
found by running a scanner that this project does not run. Set one environment
variable to mitigate it today, then upgrade and rotate secrets. Past that: the
application-layer authorization in this codebase is genuinely good — ownership scoping is correct in every
controller I read, the service-object boundary is disciplined, and several
subtle things (enumeration-resistant auth errors, price snapshotting, the
`rescue_from` ordering, the admin-routes-not-drawn-without-credentials guard)
are done deliberately and correctly. The risk is not in the domain logic. It is
concentrated in three places: **the admin surface** (one shared password, no
brute-force protection, stored in plaintext in the browser, same origin as the
public app), **the unauthenticated write endpoints** (unlimited rows and
unlimited outbound email, from anyone), and **everything around the code**
(no deploy pipeline, no dependency scanning, no monitoring, no data-deletion
path). The gap is operational maturity, not craft.

---

## 1. System snapshot

What the auditee actually is, stated plainly, because several findings only make
sense against this shape:

| Property | Value |
|---|---|
| Backend | Rails 8.1, API-only mode, Ruby 3.4.5, Postgres 16, Redis 7, Sidekiq 7 |
| Frontends | 3 × Vite/React 19 SPAs (customer, vendor, admin) |
| Deployable | **One** Docker image, **one** Railway service, **one** origin |
| Auth (users) | Opaque bearer token, SHA-256 digest at rest, 30-day TTL |
| Auth (admin) | **One shared HTTP Basic credential**, env-var backed, no User row |
| Authorization | Pundit policies + ownership-scoped queries |
| Media | Cloudflare R2 via Active Storage (S3-compatible) |
| Realtime | ActionCable over Redis, token in query string |
| Payments | **None.** Vendor-arranged out-of-band via chat (ADR 0009) |
| Deploys | **Manual** `railway up` from a developer machine. No CI/CD |
| PII held | Name, email, mobile, building + unit + street, order history, private chat, chat images |
| Jurisdiction | Philippines (`prisma.kapitmarket.ph`, Semaphore SMS, PHP) |

Two properties dominate the risk profile and are worth internalizing before
reading further:

1. **One origin serves everything.** `https://prisma.kapitmarket.ph/` is the
   public customer app; `/vendor/*` is the vendor console; `/admin/*` is the
   operator console; `/api/v1/*` is the API; `/sidekiq` is the job dashboard.
   They share a localStorage partition, a cookie jar, and a script-execution
   context. There is no CSP. Any XSS anywhere on that origin reaches all of it.
2. **There is no payment gateway, and that is correct.** ADR 0009 keeps money
   entirely out of the system. This eliminates PCI-DSS scope wholesale and is
   the single best security decision in the project. Do not let anyone
   re-litigate it casually. But note SEC-09: proof-of-payment screenshots posted
   into chat quietly re-import a slice of the risk that decision avoided.

---

## 2. Standards baseline

These are the frameworks the findings are mapped against, and *why each one was
chosen for this app specifically* — a generic "we checked OWASP" is not useful
to the next agent.

### Applied as the primary control set

**OWASP ASVS 5.0 (Application Security Verification Standard)** — used as the
requirement checklist. Target **Level 1** with selected Level 2 controls. L1 is
the honest bar for a pre-launch pilot; L2 is appropriate for the auth and
session chapters (V2, V3) because this app holds home addresses. Chapters that
actually bind here: V2 (authentication), V3 (session management), V4 (access
control), V5 (validation), V7 (error handling and logging), V8 (data
protection), V12 (files), V14 (configuration).

**OWASP API Security Top 10 (2023)** — the more relevant list than the classic
web Top 10, since the entire attack surface is a JSON API consumed by SPAs and
soon a native Android client. The categories that landed findings: API2 (broken
authentication), API4 (unrestricted resource consumption), API7 (SSRF — checked,
none found), API8 (security misconfiguration), API9 (improper inventory
management). Notably **API1 (BOLA/IDOR) produced no findings** — see §4.0, this
is the codebase's genuine strength.

**CWE** — used for precise defect naming so findings are greppable against
external tooling output later.

**NIST SP 800-63B (Digital Identity Guidelines, rev. 4)** — the authority for
password and session rules. Cited because the current password policy is not
weak-by-choice, it is absent, and 800-63B is the standard that says what
"present" means (≥8 characters, breach-corpus blocklist, no forced composition
rules, no forced rotation).

**NIST SSDF (SP 800-218) + SLSA** — the supply-chain and build-integrity
baseline. Chosen because the largest architectural gap here is not in the
application, it is that a laptop pushes unreviewed bytes straight to production.
SSDF practices PO.3, PS.3, PW.4, PW.7, RV.1 are the ones being missed.

**OWASP Secure Headers Project** — for the response-header findings, since Rails
API-only mode ships none of them and nothing in this repo adds them.

**CIS Docker Benchmark** — light touch, for the container findings. The
Dockerfile is already better than most (multi-stage, non-root user, slim base).

### Applied as the compliance/legal frame

**Republic Act 10173 — the Data Privacy Act of 2012 (Philippines)**, its IRR,
and **NPC Circular 16-01** (security of personal data in government) /
**16-03** (personal data breach management). This is the operative privacy law,
not GDPR. The app is a Personal Information Controller processing personal
information of Philippine residents. Details in §5 — this is the section most
likely to be skipped and most likely to matter.

**GDPR** is referenced only where its concepts (data minimization, right to
erasure, purpose limitation) are useful design vocabulary. It does not
independently apply unless the pilot serves EU residents.

**PCI-DSS** is explicitly **out of scope** and should stay that way. Recorded
here so a future reviewer does not "add it back."

### Deliberately not applied

ISO 27001, SOC 2, HIPAA. None are relevant to a pre-revenue neighborhood pilot
with no enterprise customers and no health data. Adding them now would generate
paperwork, not safety.

---

## 3. Findings summary

| ID | Severity | Title | Standard |
|---|---|---|---|
| [SEC-00](#sec-00) | **Critical (9.5)** | **CVE-2026-66066** — unauthenticated arbitrary file read → RCE in Active Storage variant processing | API6, ASVS V14.2, CWE-22/94 |
| [SEC-01](#sec-01) | **Critical** | Admin console: shared password, no brute-force limit, plaintext in localStorage, same origin as public app | API2, ASVS V2.2.1, CWE-307/522 |
| [SEC-02](#sec-02) | **High** | `admin`/`admin` fallback reachable if `ADMIN_PASSWORD` is unset (and it is undocumented) | ASVS V14.1, CWE-1188/798 |
| [SEC-03](#sec-03) | **High** | Suspending a user does not revoke their access | ASVS V3.3, CWE-613 |
| [SEC-04](#sec-04) | **High** | Unauthenticated, unthrottled, unbounded writes that each send an email | API4, CWE-770/799 |
| [SEC-05](#sec-05) | **High** | No password policy at all — a 1-character password is accepted | 800-63B §3.1.1.2, CWE-521 |
| [SEC-06](#sec-06) | Medium | Login throttled per-IP only; no per-account lockout | ASVS V2.2.1, CWE-307 |
| [SEC-07](#sec-07) | Medium **[VERIFY]** | Rate limits keyed on a possibly client-spoofable IP | CWE-290 |
| [SEC-08](#sec-08) | Medium | Image validation trusts the client-declared MIME type | ASVS V12.2, CWE-434 |
| [SEC-09](#sec-09) | Medium | Private chat images are permanently public to any URL holder | ASVS V8.3, CWE-425 |
| [SEC-10](#sec-10) | Medium | No security response headers (no CSP, nothing) | ASVS V14.4 |
| [SEC-11](#sec-11) | Medium | Bearer token in the WebSocket query string | ASVS V3.1, CWE-598 |
| [SEC-12](#sec-12) | Medium | No token rotation, idle timeout, or per-user token cap | ASVS V3.3 |
| [SEC-13](#sec-13) | Low | No `config.hosts`; Host header reaches Open Graph tags | CWE-350/644 |
| [SEC-14](#sec-14) | Low | `Rack::Attack.enabled` expression is a silent no-op | CWE-670 |
| [SEC-15](#sec-15) | Low | Admin search passes raw input into a LIKE pattern | CWE-1333-adjacent |
| [SEC-16](#sec-16) | Low | Email change needs no re-auth and notifies nobody | ASVS V2.5 |
| [SEC-17](#sec-17) | Info | No SAST, dependency, or secret scanning in CI; frontends have no CI at all | SSDF PW.4/RV.1 |

| ID | Severity | Title |
|---|---|---|
| [ARC-01](#arc-01) | **High** | Single origin + single service = no blast-radius containment |
| [ARC-02](#arc-02) | **High** | No deployment pipeline; production is whatever a laptop last pushed |
| [ARC-03](#arc-03) | Medium **[VERIFY]** | No documented backup, restore, or migration-rollback story |
| [ARC-04](#arc-04) | Medium | A database write on every authenticated request |
| [ARC-05](#arc-05) | Medium | Authorization is enforced by convention, with no structural backstop |
| [ARC-06](#arc-06) | Medium | No observability: abuse is undetectable while it happens |
| [ARC-07](#arc-07) | Medium | No data retention policy and no account-deletion path |
| [ARC-08](#arc-08) | Low | Inconsistent invariant enforcement; checkout can oversell |
| [ARC-09](#arc-09) | Low | No API contract for the planned Android client |
| [ARC-10](#arc-10) | Low | Guest-cart merge on login is non-atomic and non-idempotent |

---

## 4. Security findings

### 4.0 What is already right (do not "fix" these)

Stated first, deliberately. A future agent handed a findings list tends to
"improve" things that are already correct. These are correct:

- **Object-level authorization has no holes I could find.** Every controller
  either goes through a Pundit policy (`OrdersController#set_order`,
  `ConversationsController#set_conversation`, `RatingsController#set_order`,
  `Vendor::ItemsController#set_item`) or through an ownership-scoped query
  (`AddressesController#set_address`, `CartController#set_cart_item`,
  `Vendor::CustomerNotesController`). Cross-tenant IDs return 404, not 403,
  which is the right choice — it does not confirm the record exists.
  **OWASP API1 (BOLA) is the #1 API risk industry-wide and this codebase does
  not have it.** That is unusual and worth saying.
- **Auth error messages are enumeration-resistant** by explicit design, in three
  separate places, with comments explaining why:
  `auth/authenticate_user.rb:15`, `auth/request_password_reset.rb`,
  `auth/reset_password.rb:9`.
- **Password reset revokes all tokens** (`auth/reset_password.rb:30`).
- **Tokens are stored as digests**, never plaintext (`api_token.rb:16`).
  Verification codes are BCrypt-hashed with a 10-minute TTL and a 5-attempt cap
  (`verification_challenge.rb:26-56`).
- **Admin credentials are compared with `secure_compare`**, not `==`
  (`admin/base_controller.rb:29`).
- **Admin routes are not drawn at all** unless `ADMIN_USERNAME` is set
  (`routes.rb:143`) — a genuinely thoughtful guard. (Its gap is SEC-02, and the
  gap is the *password* half, not this.)
- **Test-helper endpoints are guarded three ways**: route not drawn outside
  dev/test, a runtime `TestHelperAccess.enabled?` check, and a boot-time raise
  if `ENABLE_TEST_HELPERS` is ever set in production
  (`initializers/test_helpers.rb:12`). This is defense in depth done properly.
- **Prices are snapshotted at checkout** (`carts/checkout.rb:68-81`), so a
  vendor cannot retroactively change what a customer agreed to pay.
- **`Shop.matching_word` uses `sanitize_sql_like`** correctly (`shop.rb`).
  No SQL injection was found anywhere in the codebase.
- **The Dockerfile runs as a non-root user** and uses multi-stage builds
  (`Dockerfile:97-99`).

---

<a id="sec-00"></a>
### SEC-00 — CVE-2026-66066: unauthenticated arbitrary file read → RCE via Active Storage variant processing
**Severity: Critical — CVSS v4 9.5** · GHSA-xr9x-r78c-5hrm · API6 · ASVS V14.2.1 · CWE-22, CWE-94

**Fix this before anything else in this document.**

Found by `bundler-audit` against `apps/api/Gemfile.lock` (advisory DB commit
`e814c84`, 2026-08-02). Published 2026-07-29 — **six days before this audit**.

```
Name: activestorage
Version: 8.1.3
CVE: CVE-2026-66066   GHSA: GHSA-xr9x-r78c-5hrm   CVSS v4: 9.5
Title: Possible arbitrary file read and remote code execution in
       Active Storage variant processing
Solution: update to '~> 7.2.3, >= 7.2.3.2', '~> 8.0.5, >= 8.0.5.1', '>= 8.1.3.1'
```

**From the advisory:** *"In its default configuration, a Rails application that
displays image variants may allow an unauthenticated attacker to read arbitrary
files from the server, including the process environment. That environment
typically holds `secret_key_base` and often credentials for external systems,
which may in turn allow escalation to remote code execution or lateral movement
to those systems."*

**This application meets every precondition. I verified each one:**

| Precondition | Status |
|---|---|
| Uses libvips as the variant processor | ✅ `config.load_defaults 8.1` (`config/application.rb:24`) sets `:vips`; nothing overrides it — `grep -rn variant_processor config/` returns nothing. `ruby-vips (2.3.0)` and `image_processing (1.14.0)` are both in `Gemfile.lock`. |
| Accepts image uploads from untrusted users | ✅ Three separate paths: vendor item photos, vendor shop profile/cover/opening-message photos, and **customer chat images** (`ImageAttachable`, ADR 0006). |
| Vulnerable version | ✅ `rails (8.1.3)`, `activestorage (8.1.3)`. Patch line is `>= 8.1.3.1`. |

Note the advisory's explicit clarification: *"Generating variants is not a
separate requirement."* Merely accepting the upload is enough.

**This app is worse-positioned than the baseline case**, for reasons already
documented elsewhere in this audit:

- **SEC-08** identified an *unauthenticated* variant-processing path: any
  request with a recognized crawler user-agent to `/shops/:slug` triggers a
  `resize_to_fill` variant (`social_previews/build_shop_meta.rb:53` via
  `static_controller.rb:31`). No login, no token — a `User-Agent: facebookexternalhit`
  header is the entire entry requirement.
- **SEC-08** also found that **upload content-type validation trusts the
  client-declared MIME type**, so nothing stops a crafted non-image file from
  being accepted as `image/png` and reaching the processor.
- The stolen environment is unusually valuable here: `secret_key_base`, plus
  `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` (all user photos), `RESEND_API_KEY`
  (send mail as the app), `SEMAPHORE_API_KEY` (send SMS, spend real money),
  `DATABASE_URL`, `REDIS_URL`, and — per **SEC-01/SEC-02** — `ADMIN_USERNAME`
  and `ADMIN_PASSWORD`. **This finding chains directly into full admin
  compromise.**

**Remediation — do all three, in this order:**

**1. Today, without a deploy** — `ruby-vips` is at `2.3.0`, which is `>= 2.2.1`,
so the upstream workaround is available. Add an initializer:

```ruby
# config/initializers/vips_block_untrusted.rb
# Mitigates CVE-2026-66066 by disabling libvips' unfuzzed loaders.
# Remove once Rails is on >= 8.1.3.1 (kept as defense in depth is also fine).
Vips.block_untrusted(true) if defined?(Vips)
```

Or set `VIPS_BLOCK_UNTRUSTED=1` as a Railway environment variable, which needs
no rebuild at all and is therefore the fastest possible action. Do that first.

**2. This week — the actual fix.** Bump to Rails `8.1.3.1`:

```bash
cd apps/api && bundle update rails --conservative && bundle exec rspec
```

A patch-level bump within 8.1.x; expect no application changes.

**3. Assume the environment may already be exposed.** The vulnerability has been
public since 2026-07-29 and the app has been live at `prisma.kapitmarket.ph`.
There is no way to determine from the repository whether it was exploited, and
per **ARC-06** there is no logging that would show it. Treat every secret in the
Railway environment as potentially compromised and **rotate all of them**:
`SECRET_KEY_BASE`, R2 keys, `RESEND_API_KEY`, `SEMAPHORE_API_KEY`, database and
Redis credentials, `ADMIN_PASSWORD`, `SIDEKIQ_WEB_PASSWORD`. Rotating
`SECRET_KEY_BASE` will invalidate existing Active Storage signed URLs; that is
acceptable and expected.

This is also the concrete argument for **SEC-17** and **ARC-02**: a Dependabot
alert would have surfaced this on 2026-07-29, and a CI gate would have blocked
the release. Neither exists, so a 9.5 sat in production for six days with nobody
in a position to know.

---

<a id="sec-01"></a>
### SEC-01 — Admin console authentication is the weakest link in the system
**Severity: Critical** · API2, API8 · ASVS V2.2.1, V2.5 · CWE-307, CWE-522, CWE-798

Four separate weaknesses compound into one. Individually two of them are
defensible; together they are not.

**1. No brute-force protection on the admin API.** `config/initializers/rack_attack.rb`
throttles `/api/v1/auth`, `/verifications`, `/password_resets`, `/early_access`,
and `GET /api/v1/shops`. It does **not** throttle `/api/v1/admin/*`. There is
one password protecting every user record, every home address, every private
conversation, and every destructive admin action, and an attacker may guess it
at line speed, forever, with no lockout, no delay, and no alert.

**2. The credential is stored in plaintext in `localStorage`.**
`apps/admin-web/src/api/client.ts:33`:

```ts
localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ username, password }))
```

Not a session token — the reusable password itself, in a JSON object, readable
by any script on the origin. `apps/admin-web/src/auth.tsx:13-16` documents this
as a deliberate choice ("the two apps' sessions never mix"), and it is true that
the *keys* do not collide. But key separation is not a security boundary;
`localStorage` is partitioned by origin, and —

**3. That origin is also the public customer app.** Per `docs/architecture.md`
and `config/routes.rb:216-249`, customer-web is served at `/`, vendor-web at
`/vendor/*`, admin-web at `/admin/*` — one Rails app, one hostname. A single XSS
anywhere in the public storefront, in a vendor-supplied shop name, in an item
description, in a chat message rendered by the customer SPA, reads the operator
password out of `localStorage` and posts it away. With no CSP (SEC-10) there is
no second line of defense.

**4. No MFA, no per-operator accounts, no admin action audit log.** If the
credential is used, there is no record of who used it or what they did. Order
status changes get an `order_status_events` row, but user suspensions, shop
deletions, item deletions, tag deletions, and early-access-signup deletions
leave no trace at all.

**Blast radius.** With this one credential an attacker reads every user's email,
mobile number, and full home address (`/admin/addresses`, `/admin/users`), reads
every private conversation (`/admin/conversations/:id`), deletes shops and items,
force-transitions orders, and revokes tokens. `admin-mcp` holds the same
credential (`admin-mcp/src/client.ts:2-9`) and is the same client, so an
attacker in possession of an operator's `.env` has identical access.

**Remediation**, in ascending order of effort — do the first two immediately:

1. **Throttle it.** Add to `rack_attack.rb`:
   ```ruby
   throttle("admin/ip", limit: 5, period: 60) do |req|
     req.ip if req.path.start_with?("/api/v1/admin")
   end
   ```
   Plus an exponential-backoff `Rack::Attack.blocklist` after repeated 401s.
2. **Stop persisting the password.** Have `POST /api/v1/admin/session` exchange
   the Basic credential for a short-lived opaque admin session token; store that
   instead. Same shape as the existing `ApiToken`, different table or a
   `kind` column. The password then exists in the browser only for the duration
   of one form submit.
3. **Move the admin console to its own origin** — `admin.kapitmarket.ph`, served
   by the same Railway service via a host constraint, or a separate service.
   This is ARC-01 and fixes several findings at once.
4. **Put an identity proxy in front of it.** Cloudflare Access is free at this
   scale, the domain is already on Cloudflare (R2 is in use), and it gives MFA,
   SSO, and a per-operator audit log without writing any application code. This
   is by far the highest security-per-hour available to this project.
5. **Log every admin mutation** to a table with the acting operator identity
   (which requires 3 or 4 first, since today there is no operator identity).

---

<a id="sec-02"></a>
### SEC-02 — `admin`/`admin` is reachable if `ADMIN_PASSWORD` is unset
**Severity: High** · API8 · ASVS V14.1.3 · CWE-1188, CWE-798

`app/controllers/api/v1/admin/base_controller.rb:25-26`:

```ruby
expected_user = ENV.fetch("ADMIN_USERNAME", "admin")
expected_pass = ENV.fetch("ADMIN_PASSWORD", "admin")
```

The route guard at `config/routes.rb:143` checks **only** `ADMIN_USERNAME`:

```ruby
if Rails.env.local? || ENV["ADMIN_USERNAME"].present?
```

So an operator who sets `ADMIN_USERNAME=alain` and forgets `ADMIN_PASSWORD`
draws the entire admin namespace with the password `admin`. The guard's own
comment says it exists "so production never silently ships with an admin/admin
fallback reachable before the operator actually sets real credentials" — it
achieves that for the username and misses it for the password.

`/sidekiq` has the identical shape at `config/routes.rb:227-233`: mounted when
`SIDEKIQ_WEB_USERNAME` is present, password defaulting to `admin`. Sidekiq's
dashboard allows killing, retrying, and inspecting job arguments — which include
verification codes passed to `VerificationDeliveryJob.perform_later(challenge.id, code)`
(`auth/request_password_reset.rb:33`). **A weak Sidekiq dashboard leaks live
password-reset codes.**

Compounding: **neither variable is documented in `apps/api/.env.example`.** The
file lists `SIDEKIQ_WEB_USERNAME`/`PASSWORD` but has no `ADMIN_USERNAME`/
`ADMIN_PASSWORD` entry at all, so an operator provisioning a fresh environment
gets no prompt that they exist.

**Remediation:** replace both `ENV.fetch(key, default)` pairs with
`ENV.fetch(key)` so a missing value raises at boot, and gate the route guard on
both variables being present. Add both to `.env.example`. Consider a boot-time
initializer that raises in production if either is blank or shorter than, say,
20 characters.

---

<a id="sec-03"></a>
### SEC-03 — Suspending a user does not revoke their access
**Severity: High** · API2 · ASVS V3.3.1 · CWE-613

`app/controllers/concerns/authentication.rb:15-22` resolves a token to a user
and never inspects `user.status`:

```ruby
def authenticate!
  token = ApiToken.authenticate(bearer_token)
  raise ApiError::Unauthorized if token.nil?
  token.touch_usage!
  @current_api_token = token
  @current_user = token.user
end
```

`Admin::UsersController#suspend` (`admin/users_controller.rb:24`) only writes the
column. Grepping `suspended` across `app/` returns exactly one enforcement site:
`auth/authenticate_user.rb:16`, inside **login**.

Therefore suspension only prevents *new* logins. A suspended user's existing
bearer token keeps working for the remainder of its 30-day TTL
(`api_token.rb:6`) — they continue placing orders, messaging vendors, and
reading data. `ApplicationCable::Connection#find_verified_user`
(`app/channels/application_cable/connection.rb:15`) has the same gap, and
WebSocket connections are long-lived, so an already-open chat socket survives
indefinitely regardless.

This is the finding most likely to surprise an operator: suspension is the
*only* enforcement action the admin panel offers against an abusive user, and
it does not currently do what its name says.

**Remediation:** add the status check to `authenticate!` and to
`find_verified_user`, and revoke tokens on suspend:

```ruby
# authentication.rb
raise ApiError::Forbidden, "This account is suspended" if token.user.status == "suspended"

# admin/users_controller.rb#suspend
@user.api_tokens.update_all(expires_at: Time.current)
```

Do both. The token revocation handles the open ActionCable connection only on
its next reconnect, so the `authenticate!` check is what makes it immediate for
REST; for Cable, consider a periodic re-check or accept reconnect-time
enforcement and document it.

---

<a id="sec-04"></a>
### SEC-04 — Anonymous callers can create unbounded rows and unbounded outbound email
**Severity: High** · API4 · CWE-770, CWE-799

Two public endpoints accept writes from anyone, are not rate-limited, have no
size limits, and each trigger an outbound email.

**`POST /api/v1/client_errors`** (`api/v1/client_errors_controller.rb`,
`skip_before_action :authenticate!` at line 11). The handler builds an
`ErrorLog` and, on a new fingerprint, enqueues `ErrorAlertJob`
(line 40). `ErrorLog.record!` fingerprints on
`SHA256(exception_class + message + top_backtrace_line)`
(`app/models/error_log.rb:53, 79-81`) — and the caller controls **all three**
values (`name`, `message`, `stack` in the permitted params, line 64). Dedup
therefore provides no protection against a deliberate attacker: every request
with a fresh random `message` is a new fingerprint, a new row, and a new email
to the operator.

**`POST /api/v1/feedback`** (`api/v1/feedback_controller.rb:9`) is worse in one
respect: no fingerprint dedup at all. Every single request writes a row and
enqueues `FeedbackNotificationJob` (line 20).

Neither path appears in `rack_attack.rb`. And **no model in this application has
a single length validation** — `grep -rn "maximum:\|length:" app/models/` returns
nothing — so each row can carry as much text as Rack will accept.

**Realistic impact at pilot scale:** a bored teenager with `curl` fills the
Postgres instance, exhausts the Resend free-tier quota (making genuine
verification and password-reset emails silently fail — note `VerificationDeliveryJob`
shares the same Resend account), and buries real feedback under noise. The
Resend sending domain's reputation is also at risk, which is slow and annoying
to repair.

**Remediation:**

1. Add throttles for both paths (5/min per IP is consistent with the existing
   `early_access` rule).
2. Add `validates :message, length: { maximum: 2_000 }` and equivalents across
   the models — this is worth doing globally, not just here. `Message#body`,
   `Item#description`, `Rating#comment`, `VendorCustomerNote#note`,
   `Address#delivery_instructions`, `ErrorLog#backtrace`, and
   `Order#customer_note` are all currently unbounded.
3. Decouple alerting from request handling: batch or digest `ErrorAlertJob` and
   `FeedbackNotificationJob` rather than sending one email per event, and cap
   emails per hour regardless of event volume.
4. Consider a proof-of-work or CAPTCHA on `/feedback` if abuse materializes;
   do not add it pre-emptively.

---

<a id="sec-05"></a>
### SEC-05 — There is no password policy
**Severity: High** · ASVS V2.1.1, V2.1.7 · NIST SP 800-63B §3.1.1.2 · CWE-521

`app/models/user.rb:2` uses `has_secure_password`, which enforces exactly two
things: presence, and a 72-byte maximum (a BCrypt limit, not a policy). There is
no minimum length, no breach-corpus check, and no validation anywhere else —
neither `Auth::RegisterUser` nor `Auth::ResetPassword` adds one.

`password: "a"` is accepted at registration and at password reset.

NIST SP 800-63B requires a minimum of 8 characters and a check against a list of
commonly-used and previously-breached passwords. It equally requires **not**
imposing composition rules ("one uppercase, one symbol") and **not** forcing
periodic rotation — both of which measurably reduce security. So the fix is
narrow: a length floor and a blocklist, nothing else.

Combined with SEC-06 (no per-account lockout), this is the practical path to
mass account compromise, and account compromise here means a stranger reading
someone's home address and private messages with their neighbors.

**Remediation:**

```ruby
# app/models/user.rb
validates :password, length: { minimum: 10 }, allow_nil: true
```

(`allow_nil: true` matters — `has_secure_password` leaves `password` nil on
saves that do not change it, e.g. the `last_signed_in_at` touch at
`auth/authenticate_user.rb:18`. Without it, every unrelated user save breaks.
This is exactly the class of mistake `Auth::RegisterUser`'s own header comment
warns about for the residency fields.)

For the blocklist, either bundle a top-10k common-password list and check
membership, or call the Pwned Passwords k-anonymity API (only the first 5
characters of the SHA-1 leave your server). The former has no external
dependency and is sufficient at this scale — prefer it.

Surface the requirement in all three SPAs' registration forms so the failure is
not a surprise 422.

---

<a id="sec-06"></a>
### SEC-06 — Login is throttled per IP only; there is no per-account lockout
**Severity: Medium** · API2 · ASVS V2.2.1 · CWE-307

`config/initializers/rack_attack.rb:18-20` throttles `POST /api/v1/auth*` at 10
per minute **keyed on `req.ip`**. There is no throttle keyed on the submitted
email, and no `failed_attempts` counter on `User`.

An attacker with a rotating IP pool — trivially rented, or free via a botnet or
mobile carrier NAT churn — gets unlimited attempts against any single account.
Conversely, the per-IP rule punishes legitimate users behind shared NAT, which
in a Philippine residential building cluster is a realistic scenario: all of a
building's units can share one public IP.

**Remediation:** add a second throttle keyed on the normalized email, with a
longer window, and keep the IP rule as a coarse net:

```ruby
throttle("auth/email", limit: 5, period: 300) do |req|
  if req.path == "/api/v1/auth/login" && req.post?
    req.params["email"].to_s.strip.downcase.presence
  end
end
```

Note this reads the request body, so confirm it behaves for JSON payloads (Rack::Attack
does not parse JSON bodies by default — you may need `Rack::Attack.throttle`
with a manual `JSON.parse(req.body.read)` and a body rewind, or move the
per-account counter into `Auth::AuthenticateUser` with a Redis counter, which is
cleaner and is what I would recommend).

---

<a id="sec-07"></a>
### SEC-07 — Rate limits may be trivially bypassable via a spoofed forwarded header **[VERIFY]**
**Severity: Medium (if confirmed)** · CWE-290

Every throttle in `rack_attack.rb` keys on `req.ip`. `Rack::Attack::Request`
subclasses `Rack::Request`, so `#ip` uses Rack's own `X-Forwarded-For` handling
and trusted-proxy logic — **not** ActionDispatch's `RemoteIp` middleware, which
is what Rails configures. Behind Railway's edge proxy, whether a client-supplied
`X-Forwarded-For` can shift the value Rack::Attack keys on depends on the Rack
version's trusted-proxy heuristics and on how many proxy hops Railway inserts.

If it can be shifted, **every rate limit in this application is decorative** —
including the ones that protect verification-code sending, which cost real money
per SMS via Semaphore.

I could not resolve this statically. It must be tested against the deployed
environment.

**Verification:**

```bash
# Against production. Run 15 times; if none return 429, the IP key is spoofable.
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://prisma.kapitmarket.ph/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 10.0.0.$i" \
    -d '{"email":"nobody@example.com","password":"x"}'
done
```

Expected if healthy: `429` from roughly the 11th request onward.

**Remediation if confirmed:** set an explicit, correct proxy configuration.
Either configure `config.action_dispatch.trusted_proxies` and key throttles on
`req.env["action_dispatch.remote_ip"].to_s`, or pin Rack::Attack to the specific
`X-Forwarded-For` position Railway guarantees. Do not guess — confirm Railway's
hop count first.

---

<a id="sec-08"></a>
### SEC-08 — Image validation trusts the client-declared content type
**Severity: Medium** · ASVS V12.2.1 · CWE-434, CWE-409

`app/models/concerns/image_attachable.rb:29`:

```ruby
unless ImageAttachable::ALLOWED_CONTENT_TYPES.include?(blob.content_type)
```

`blob.content_type` is populated from the client-supplied `Content-Type` on the
multipart part (or from direct-upload metadata), not from the file's bytes.
There is no magic-byte sniffing, no re-encode, and no dimension cap.

The concern's header comment is right about the important thing — *"the clients
cannot be trusted to enforce them"* — and correctly moves the rules server-side.
The rules themselves then trust a client-supplied string.

Two consequences:

- **Content smuggling.** Arbitrary bytes (HTML, SVG with script, a polyglot) can
  be stored labeled `image/png`. Whether that becomes stored XSS depends on how
  R2 and Active Storage serve it back; Active Storage's
  `content_types_to_serve_as_binary` default gives partial protection, and this
  needs confirming against the actual R2 bucket configuration, which is outside
  the repo.
- **Decompression bombs.** `image_processing`/libvips processes uploads into
  variants — notably the 1200×630 `resize_to_fill` on the Open Graph path
  (`social_previews/build_shop_meta.rb:53`), which is reachable by **any
  unauthenticated crawler-UA request** to a shop page
  (`static_controller.rb:31`). A 5 MB file within the size limit can decode to
  gigabytes of pixels. This is an unauthenticated memory-exhaustion path.

**Remediation:**

1. Validate magic bytes, not the declared type. `Marcel::MimeType.for(io)` is
   already available transitively via Active Storage.
2. Cap decoded dimensions before variant processing (reject over ~8000px on
   either axis) and set a libvips memory limit.
3. Prefer re-encoding uploads server-side to a known-good format — it discards
   any smuggled payload and normalizes EXIF (which also carries GPS coordinates,
   directly relevant to a service whose entire premise per ADR 0002 is *not*
   knowing where people are).

Point 3 is the one I would prioritize: **EXIF GPS stripping is not currently
happening anywhere**, and vendors photographing goods in their homes are
uploading their own coordinates.

---

<a id="sec-09"></a>
### SEC-09 — Private chat images are permanently readable by anyone with the URL
**Severity: Medium** · ASVS V8.3.4 · CWE-425, CWE-200

Chat messages carry images (`app/models/message.rb:6`, ADR 0006 allows 1 per
message). They are served through Active Storage's standard blob routes, which
are **signed but not authenticated**: the signed ID is unguessable, but it does
not expire by default, is not tied to a user, and grants access to anyone who
obtains it. `ConversationPolicy` gates the *message list*; nothing gates the
*blob*.

This matters more here than in a typical app because of ADR 0009. With no
payment gateway, payment is arranged in chat — which in practice means GCash/
Maya QR codes, payment screenshots, reference numbers, and proof-of-payment
photos, plus delivery photos that may show the inside of someone's unit or their
door number. Those URLs then travel: into `Rails.logger` request lines, into
`Referer` headers if ever rendered on a page with outbound links, into browser
history, into any error report that captures a URL.

There is also no revocation. A URL that leaks is valid until the blob is purged,
and nothing purges chat images.

**Remediation:**

1. Serve chat images through an authenticated controller action that checks
   `ConversationPolicy#show?` and then streams or redirects to a **short-lived**
   presigned R2 URL (minutes, not permanent).
2. Set `config.active_storage.urls_expire_in` so even the default path issues
   expiring URLs.
3. Confirm the R2 bucket itself denies public listing and anonymous object reads
   — this is outside the repo and must be checked in the Cloudflare console.
4. Decide a retention period for chat images (see ARC-07 and §5).

---

<a id="sec-10"></a>
### SEC-10 — No security response headers
**Severity: Medium** · ASVS V14.4 · OWASP Secure Headers Project

Nothing in `config/application.rb`, `config/environments/production.rb`, or any
initializer sets response security headers. Rails API-only mode
(`config.api_only = true`, `application.rb:42`) ships none by default.

Missing: `Content-Security-Policy`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`/`frame-ancestors`.
Present: HSTS, via `config.force_ssl = true` (`production.rb:46`) — correctly
paired with `assume_ssl` for Railway's TLS termination (line 43), which is a
detail many teams get wrong.

Because this one Rails app serves the HTML shells for all three SPAs
(`StaticController`), these headers apply to real documents, not just JSON. CSP
in particular is the missing mitigation that turns SEC-01 from "one XSS away
from total compromise" into "one XSS away from a contained problem."

**Remediation:** add a `config.action_dispatch.default_headers` block plus a CSP
initializer. Start CSP in `Content-Security-Policy-Report-Only` mode, point the
report URI at the existing `/api/v1/client_errors` endpoint (a nice reuse of
what is already built), and enforce once clean. Vite's build output is
hash-friendly; `script-src 'self'` should be achievable without `unsafe-inline`.

---

<a id="sec-11"></a>
### SEC-11 — Bearer token in the WebSocket query string
**Severity: Medium** · ASVS V3.1.1 · CWE-598

`config/routes.rb:7-10` and `app/channels/application_cable/connection.rb:15`
pass the long-lived bearer token as `?token=` because WebSocket handshakes
cannot carry an `Authorization` header. The tradeoff is documented in a comment,
which is the right instinct — but the mitigation was never added.

Query strings are logged by essentially everything: Rails' own request logger,
Railway's edge, any future CDN or WAF, browser history, and any intermediary.
The token is valid for 30 days (SEC-12), so a single log entry is a 30-day
credential.

**Remediation:** the standard pattern is a **connection ticket**. Add an
authenticated `POST /api/v1/cable_tickets` that mints a single-use token valid
for ~30 seconds, and pass *that* in the query string. `Connection#find_verified_user`
consumes and immediately invalidates it. The long-lived token never touches a
URL. This is maybe 40 lines of code and closes the finding cleanly.

---

<a id="sec-12"></a>
### SEC-12 — No token rotation, idle timeout, or per-user token cap
**Severity: Medium** · ASVS V3.3.1, V3.3.2

`ApiToken::TTL = 30.days` (`app/models/api_token.rb:6`) is an absolute lifetime
with no refresh and no idle expiry. `touch_usage!` records `last_used_at` on
every request (line 31-33) but nothing ever reads it to expire idle sessions.
Every login mints a new row (`auth/authenticate_user.rb:19`) and nothing prunes
old ones, so a user's token table grows without bound and each old token stays
valid for its full 30 days.

The only bulk revocation is on password reset (`auth/reset_password.rb:30`).
There is no "sign out of all devices" for a user, and — per SEC-03 — no
revocation on suspension.

**Remediation:** shorten the absolute TTL (7 days is reasonable for a consumer
app of this kind) and add a refresh path, or add an idle timeout that reads the
`last_used_at` this code already maintains. Cap active tokens per user and evict
oldest-first. Expose "sign out everywhere" in account settings. Note that
shortening the TTL interacts with ARC-04 — an idle timeout makes the per-request
write meaningful rather than merely expensive.

---

<a id="sec-13"></a>
### SEC-13 — No trusted-host allowlist; the Host header reaches Open Graph output
**Severity: Low** · CWE-350, CWE-644

`config/environments/production.rb:86-89` leaves `config.hosts` commented out, so
production accepts any `Host` header. `SocialPreviews::BuildShopMeta` composes
`og:image` and `og:url` from `request.base_url`
(`app/controllers/static_controller.rb:31`, `build_shop_meta.rb:36-40`), so a
spoofed Host produces attacker-controlled absolute URLs inside the meta tags
served to crawlers.

Real impact today is low: there is no shared cache in front of Rails, so a
poisoned response is not retained, and the injected value is HTML-escaped
(`inject_meta_tags.rb:50` — correctly, via `ERB::Util.html_escape`). It becomes a
genuine web-cache-poisoning bug the moment a CDN is placed in front, which is a
likely next step given Cloudflare is already in the stack.

**Remediation:** uncomment and populate `config.hosts` with the real hostnames,
with the documented `/up` exclusion so Railway's health check still passes.

---

<a id="sec-14"></a>
### SEC-14 — `Rack::Attack.enabled` expression is a silent no-op
**Severity: Low** · CWE-670

`config/initializers/rack_attack.rb:5`:

```ruby
Rack::Attack.enabled = ENV.fetch("RACK_ATTACK_ENABLED", !Rails.env.test?.to_s) != "false"
```

`.to_s` binds tighter than `!`, so this parses as `!(Rails.env.test?.to_s)`.
`Rails.env.test?.to_s` is the *string* `"true"` or `"false"`, both truthy, so the
negation is always `false`. The default value handed to `ENV.fetch` is therefore
always `false` (the boolean), and `false != "false"` is always `true`.

Net effect: **Rack::Attack is enabled unconditionally**, including in the test
environment, contradicting the comment directly above it ("Throttling is
disabled in the test environment so specs are deterministic").

The specs pass only because `config/environments/test.rb:29` sets
`config.cache_store = :null_store`, so throttle counters never persist. The
stated protection is accidental. If anyone ever gives the test environment a
real cache store — a reasonable thing to do while writing tests *for* the
throttles — a batch of unrelated request specs will start failing intermittently
and the cause will not be obvious.

**Remediation:**

```ruby
Rack::Attack.enabled = ENV.fetch("RACK_ATTACK_ENABLED", (!Rails.env.test?).to_s) != "false"
```

Worth fixing not for its impact but because it is a live example of intent
diverging from behavior in the security configuration, which is exactly where
that divergence is most expensive.

---

<a id="sec-15"></a>
### SEC-15 — Admin search passes raw input into a LIKE pattern
**Severity: Low**

`app/controllers/api/v1/admin/users_controller.rb:12`:

```ruby
scope = scope.where("email ILIKE :q OR mobile_number ILIKE :q", q: "%#{params[:q]}%")
```

This is **not** SQL injection — the value is properly bind-parameterized. But
`%` and `_` from the caller are passed through as LIKE metacharacters, so
`q=%` scans the entire users table on every keystroke of the admin search box,
and `q=_` matches everything of length ≥1.

The correct pattern already exists in this codebase: `Shop.matching_word` uses
`sanitize_sql_like` (`app/models/shop.rb`). The admin path just does not use it.

**Remediation:** `q: "%#{Shop.sanitize_sql_like(params[:q])}%"`, or better, move
the search into a model scope so both paths share one implementation. Check the
other admin controllers for the same shape (`shops`, `items` both accept `q`).

---

<a id="sec-16"></a>
### SEC-16 — Changing the account email requires no re-authentication and notifies nobody
**Severity: Low** · ASVS V2.5.6

`app/controllers/api/v1/me_controller.rb:14-22` lets any valid bearer token
change the account's `email` — the login identifier — with no current-password
challenge, no confirmation link to the *old* address, and no notification to it.
`reset_verification_stamps` (line 62-65) clears the verified flag, which is
correct but is not the same as consent.

An attacker holding a stolen token (see SEC-11, SEC-12) changes the email,
triggers a password reset to the new address, and owns the account permanently.
The real owner receives nothing.

**Remediation:** require the current password to change email or mobile, and
send a notification to the *previous* address whenever either changes. This is
cheap and it is what users expect.

---

<a id="sec-17"></a>
### SEC-17 — No SAST, dependency, or secret scanning; frontends have no CI at all
**Severity: Informational (but see ARC-02 — this is the enabling gap)** · NIST SSDF PW.4, PW.7, RV.1 · SLSA L1

`.github/workflows/api-ci.yml` is the only workflow. It runs `bundle exec rspec`
against Postgres and Redis. That is all.

Absent:

- **Brakeman** — the standard Rails SAST tool, would have flagged several
  findings above automatically.
- **`bundle audit`** / **`bundler-audit`** — no check against the Ruby Advisory
  Database. **This is how CVE-2026-66066 (CVSS 9.5) sat undetected in production
  for six days. See [SEC-00](#sec-00) and [§4.1](#41-dependency-scan-results-executed-2026-08-04).**
- **`npm audit`** — no check on any of four Node projects (three SPAs plus
  `admin-mcp`, plus `e2e`).
- **Dependabot or Renovate** — no `.github/dependabot.yml`; nothing tells anyone
  a dependency has a published CVE. Dependabot would have alerted on SEC-00 on
  2026-07-29, the day it was published.
- **Secret scanning** — no gitleaks/trufflehog. `apps/api/config/credentials.yml.enc`
  is committed (correct — it is encrypted) and `config/master.key` is properly
  gitignored (`apps/api/.gitignore:24`), so nothing is currently leaked. There is
  simply nothing preventing the next one.
- **Any frontend CI whatsoever.** `apps/customer-web`, `apps/vendor-web`, and
  `apps/admin-web` all have vitest suites (`*.test.tsx` files throughout) and
  none of them run in CI. Neither does the Playwright suite in `e2e/`. Nor is
  there a typecheck or lint job, despite `apps/vendor-web/.oxlintrc.json`
  existing.
- **No SBOM**, no build provenance, no artifact signing (SLSA L1 not met).

The root-cause note: **even if all of this were added, it could not block a
release**, because releases do not go through GitHub at all (ARC-02). Fix ARC-02
first or this work is advisory only.

**Remediation:** add Brakeman + bundler-audit to the API job; add a matrix job
for the three SPAs running `tsc --noEmit`, lint, and vitest; enable Dependabot
for `bundler` and all four `npm` directories; enable GitHub secret scanning and
push protection (free on public repos, and available on private with Advanced
Security). Then make CI a required check and wire deployment to it.

---

## 4.1 Dependency scan results (executed 2026-08-04)

Scans run: `bundler-audit` 0.9.3 (advisory DB `e814c84`) against
`apps/api/Gemfile.lock`, and `npm audit` against all five Node projects.

### Ruby — 1 finding, and it is the most serious item in this audit

| Gem | Version | Advisory | CVSS | Reachable? |
|---|---|---|---|---|
| `activestorage` | 8.1.3 | CVE-2026-66066 | **9.5** | **Yes — unauthenticated.** See [SEC-00](#sec-00). |

No other Ruby advisories. The rest of the Gemfile is clean.

### JavaScript — 22 raw findings, **0 reachable in production**

`npm audit` reports "7 vulnerabilities (3 moderate, 3 high, 1 critical)" for each
of the three SPAs, 1 moderate for `admin-mcp`, and 0 for `e2e`. **Do not
escalate on those labels.** I checked reachability for each; every one is either
a development-only dependency or an unused code path.

| Package | Advisory | npm severity | Actual exposure |
|---|---|---|---|
| `vitest` ≤3.2.5 | GHSA-5xrq-8626-4rwp | **critical** | **None in production.** `devDependency`; the flaw requires the Vitest **UI server** to be listening. Scripts are `vitest run` / `vitest` — `--ui` is never used, and no test tooling ships in the built bundle. |
| `vite` ≤6.4.2 | GHSA-fx2h-pf6j-xcff | high | **None in production.** `devDependency`; `server.fs.deny` bypass affects the **dev server**, and additionally is Windows-specific. This project deploys static build output. |
| `vite` ≤6.4.2 | GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3 | moderate | Same — dev server only; the second is a Windows NTLM issue and this is a Linux/macOS project. |
| `esbuild` ≤0.24.2 | GHSA-67mh-4wv8-2f99 | moderate | **None in production.** Transitive under `vite`; dev server only. |
| `react-router` 7.12.0–8.2.0 | GHSA-qwww-vcr4-c8h2 | high | **Not reachable.** This is an **RSC-mode** CSRF bypass. All three SPAs use plain client-side `BrowserRouter` (`apps/*/src/main.tsx:3`) with no RSC, no framework mode, and no React Router server. This is the only *runtime* dependency on the list, so it is the one to patch first regardless. |
| `hono` <4.12.34 | GHSA-8j4g-w8fx-2239 | moderate | **Not reachable.** Transitive under `@modelcontextprotocol/sdk` (`npm ls hono` shows no direct dependency). The flaw is ReDoS in **CORS middleware**; `admin-mcp` uses `StdioServerTransport` (`admin-mcp/src/index.ts`) and runs no HTTP server at all. |

**Interpretation.** The dev-server findings are not nothing — they are a real
risk to a developer running `npm run dev` on an untrusted network (a café, a
co-working space), where a malicious page can reach `localhost` and read source.
They are simply not a production risk for this application, and treating a
"critical" `vitest` label as equivalent to a 9.5 unauthenticated RCE would be a
serious misallocation of attention.

**Remediation.** All fixes are non-breaking except the `vite`/`vitest` majors:

```bash
# Non-breaking. Fixes react-router (the only runtime dep) and hono.
( cd apps/customer-web && npm audit fix )
( cd apps/vendor-web   && npm audit fix )
( cd apps/admin-web    && npm audit fix )
( cd admin-mcp         && npm audit fix )

# Major bumps: vite 5→8, vitest 2→4. Do deliberately, run the suites after.
# Not urgent — dev-tooling only.
```

**The meta-finding is the one that matters.** Nothing in this repository would
have told anyone about any of the above. SEC-00 was published 2026-07-29 and
found here on 2026-08-04 only because this audit ran the scanner by hand. See
[SEC-17](#sec-17) and [ARC-02](#arc-02) — those two are the reason a 9.5 sat
undetected, and fixing them is what prevents the next one.

---

## 5. Privacy and legal compliance

**This section is the one most likely to be skipped and is arguably the highest
real-world risk in the audit.** The application-layer security issues above are
fixable in days. A privacy-law problem discovered after launch is not.

### The governing law is RA 10173, not GDPR

The Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules
and Regulations, and the National Privacy Commission's circulars govern this
service. The operator is a **Personal Information Controller (PIC)**.

`docs/legal/README.md` already establishes this correctly, and the drafts in
that folder are written against RA 10173 rather than generic boilerplate — that
groundwork does not need redoing. What follows checks the *code* against those
obligations, which is the part the drafts cannot cover.

**What is being collected** (from `db/schema.rb` and the registration flow):
full name (`users.first_name`, `last_name`), email, mobile number, home
**building + unit + street + city** (`addresses`), residency status
(`customer_profiles.is_resident`), complete order history, private
customer↔vendor conversations, chat images, and marketing consent flags.

Full name + mobile number + home address, in combination, is precisely the
dataset that triggers the DPA's most demanding obligations. It is the
combination that "may enable identity fraud" under NPC Circular 16-03.

### Obligations, and where this project stands

| Obligation | Source | Status |
|---|---|---|
| Appoint a Data Protection Officer | DPA §21, NPC Advisory 17-01 | **Not evidenced in repo.** Verify `docs/legal/privacy-policy.md` names one. |
| NPC registration of the data processing system | NPC Circular 17-01 | **Likely not required at pilot scale** (thresholds: ≥250 employees, or sensitive personal info of ≥1,000 individuals). Re-check before scaling. Note: registration thresholds are *not* the trigger for the other duties below — those apply regardless. |
| Privacy notice at point of collection, with lawful basis | DPA §16(a-b) | Draft exists at `docs/legal/privacy-policy.md`, **pending lawyer review** per `docs/legal/README.md`. |
| Consent for marketing, separate from service | DPA §3(b) | ✅ **Done correctly.** `email_marketing_opt_in` / `sms_marketing_opt_in` are captured separately at registration (`auth/register_user.rb:28-29`) and stored per-user. Terms acceptance is versioned (`terms_version`, `CURRENT_TERMS_VERSION`). This is genuinely good practice. |
| Organizational, physical, technical security measures | DPA §20, NPC Circular 16-01 | Partial. See every finding in §4. |
| **72-hour breach notification** to NPC and affected data subjects | DPA §20(f), NPC Circular 16-03 | **Not achievable today.** See below. |
| Data subject rights: access, correction, **erasure**, portability, objection | DPA §16(c-e) | **Erasure and portability have no implementation.** See ARC-07. |
| Retention limited to purpose | DPA §11(e) | **No retention policy, no deletion, nothing expires.** |

### The two that actually bite

**1. Breach notification is undeliverable.** The DPA requires notifying the NPC
and affected individuals within **72 hours of knowledge** of a breach involving
sensitive personal information or information that could enable identity fraud —
which this dataset is. But per ARC-06 there is no monitoring, no auth-failure
alerting, and no admin access log. There is no mechanism by which the operator
would *acquire knowledge* of a breach in the first place. The 72-hour clock
cannot start on a breach nobody can see. There is also no incident response plan
in the repository.

This makes ARC-06 a **legal** requirement, not merely an operational nicety.
It is the reason ARC-06 is ranked where it is in the roadmap.

**2. There is no way to delete a user.** `config/routes.rb` has no account
deletion endpoint. `Admin::UsersController` explicitly documents that deletion is
never offered — *"never a hard delete; a User cascade-owns too much"* (line
21-22). That reasoning is sound engineering and is nonetheless legally
insufficient: a data subject has a statutory right to erasure, and "our schema
makes it hard" is not a recognized exemption.

The tension is real and needs a designed answer, not a bolt-on. Order records
are legitimately retained (a completed transaction between two neighbors is a
record both parties may need). The standard resolution is **anonymization rather
than deletion**: null the direct identifiers on `users`, `addresses`, and
`customer_profiles`; retain `orders` and `order_items` with their snapshotted
values and a tombstoned customer reference; purge chat messages and images.
Write it as an ADR — it is exactly the kind of decision this project's ADR
convention exists for.

### PCI-DSS: out of scope, and keep it that way

ADR 0009's no-payment-gateway decision removes card data from the system
entirely. **PCI-DSS does not apply.** This is recorded explicitly so a future
reviewer does not "helpfully" reintroduce scope.

The caveat is SEC-09: proof-of-payment screenshots posted into chat land in R2 as
permanently-URL-addressable blobs. Those are not card data, but they are
financial records with real sensitivity, currently protected only by URL
unguessability and retained forever. If payments ever *do* come in-app, this
entire section must be rewritten first.

### Recommended actions

1. Confirm `docs/legal/privacy-policy.md` names a DPO, states a lawful basis per
   processing purpose, and states a **retention period** — then make sure the
   code can actually honor that period (it currently cannot).
2. Write an ADR for account deletion/anonymization and implement it.
3. Write an incident response plan, including who notifies the NPC and how.
4. Get the legal drafts through lawyer review before onboarding a single real
   neighbor. `docs/legal/README.md` already flags this; treat it as a launch
   blocker, because it is.

---

## 6. Architecture findings

<a id="arc-01"></a>
### ARC-01 — One origin, one service: no blast-radius containment
**Severity: High**

Per `docs/architecture.md` and `apps/api/Dockerfile:92-94`, a single Docker image
and a single Railway service serve: the public customer SPA at `/`, the vendor
SPA at `/vendor/*`, the operator SPA at `/admin/*`, the public API, the admin
API, ActionCable, and Sidekiq's dashboard at `/sidekiq`.

For a solo-founder pilot this is the right *deployment* call — one thing to
deploy, one thing to monitor, one bill. I would not argue with it. The problem is
that it also collapses every **browser-side isolation boundary** that would
normally separate a public storefront from an operator console:

- Same origin ⇒ same `localStorage` partition ⇒ the admin password (SEC-01) is
  readable by any script the public storefront executes.
- Same origin ⇒ no `Origin`-based distinction available to the server, so CORS
  cannot help.
- Same process ⇒ a resource-exhaustion attack on the public API (SEC-04) takes
  down the operator's ability to respond to it.
- Same deployment ⇒ no ability to expose the admin surface only to a VPN or an
  allowlist.

**Recommendation:** split the *origin*, not necessarily the service. Serving
admin-web from `admin.kapitmarket.ph` via a Rails routing constraint keeps one
deployable while restoring the browser boundary — a small change with
disproportionate benefit. Then put Cloudflare Access in front of that hostname.
That single move meaningfully improves SEC-01, SEC-02, and SEC-10 at once, and
costs nothing at this scale.

---

<a id="arc-02"></a>
### ARC-02 — There is no deployment pipeline
**Severity: High** · NIST SSDF PO.3, PS.3 · SLSA L1 not met

From `docs/architecture.md`, quoted because it is unusually candid and should not
be softened:

> **Deploys are manual, not git-triggered.** Railway's `api` service has no
> connected source — pushing to GitHub does nothing. [...] This has caused real
> confusion (the live site ran days-old code while local commits kept landing) —
> there is no CI/CD pipeline here yet, just this one manual command.

Production is whatever bytes were last on a developer's laptop when they ran
`railway up --path-as-root .`. Consequences:

- **No provenance.** Nothing links the running image to a commit. During an
  incident, "what code is live?" is unanswerable without redeploying.
- **No gate.** CI passing is not a precondition for shipping. Every scanner
  recommended in SEC-17 would be advisory-only.
- **Uncommitted local changes ship.** `railway up` uploads the working tree.
- **No rollback.** No tagged previous artifact to redeploy.
- **No audit trail** of who deployed what, when — which is also a DPA §20
  organizational-measures gap.

Note the repo is already *almost* there: `Procfile` defines `release: bin/rails db:migrate`,
and `railway.json` pins the Dockerfile. The wiring is what is missing.

**Recommendation:** connect the Railway service to the GitHub repo, or add a
GitHub Actions deploy job gated on CI, triggered on `main`. Tag images with the
commit SHA. Keep the manual command documented as the break-glass path. This is
a few hours of work and it unblocks SEC-17 entirely.

---

<a id="arc-03"></a>
### ARC-03 — No documented backup, restore, or migration-rollback story **[VERIFY]**
**Severity: Medium**

`bin/docker-entrypoint` runs `./bin/rails db:prepare` on server boot, and
`Procfile` declares `release: bin/rails db:migrate`. Both run migrations
automatically; neither has a rollback path, and a failed migration mid-deploy has
no defined recovery.

Nothing in the repository documents Postgres backup frequency, retention, or —
critically — whether a **restore has ever been tested**. Railway offers backups;
whether they are enabled for this project is outside the repo and must be
confirmed in the Railway console.

Given this database holds home addresses and private conversations for real
people, an untested restore path is a serious operational risk and arguably a
DPA §20 availability-measure gap.

**Verification:** check the Railway Postgres service for backup configuration and
retention; perform one restore into a scratch environment and time it.

**Recommendation:** document the backup schedule, retention, and RTO/RPO in
`docs/`. Test a restore. Consider making migrations explicitly reversible and
splitting destructive schema changes into expand/contract phases.

---

<a id="arc-04"></a>
### ARC-04 — A database write on every authenticated request
**Severity: Medium**

`app/models/api_token.rb:31-33`:

```ruby
def touch_usage!
  update_column(:last_used_at, Time.current)
end
```

Called from `Authentication#authenticate!` (line 19) — every authenticated REST
request — and from `ApplicationCable::Connection#find_verified_user` (line 18) —
every WebSocket connect. Every request therefore issues an `UPDATE` to the
primary database.

At pilot scale this is invisible. It is flagged because of what it forecloses:
read-replica routing becomes impossible for authenticated traffic (every request
writes), row-level lock contention appears on hot tokens, and it converts a
read-only endpoint like `GET /api/v1/shops` into a write. It is also, per SEC-12,
**data nobody reads** — `last_used_at` is written on every request and consumed
by nothing.

**Recommendation:** either sample the write (only update when `last_used_at` is
older than ~15 minutes) or drop it until something consumes it. Sampling is
better, since an idle-timeout implementation (SEC-12) would make the column
genuinely useful.

---

<a id="arc-05"></a>
### ARC-05 — Authorization is enforced by convention, with no structural backstop
**Severity: Medium**

`grep -rn "verify_authorized\|verify_policy_scoped" app/` returns nothing.
Pundit is included in `ApplicationController` (line 2) but its safety
`after_action` hooks are not enabled anywhere.

To be clear about what this finding is and is not: I read every controller and
**found no missing authorization check**. Today the code is correct. Two
different correct idioms are in use — Pundit `authorize` in some controllers,
ownership-scoped `find` in others — and both are applied consistently, with the
`Vendor::CustomerNotesController` header comment explaining the scoping choice
particularly well.

The gap is that nothing *fails* if a future controller uses neither. A new
endpoint written by a future contributor (or a future agent) that forgets both
will silently expose data, pass code review that is looking at business logic,
and pass a test suite that only tests happy paths.

**Recommendation:** the cheapest high-value hardening available in this codebase:

```ruby
# app/controllers/api/v1/base_controller.rb
after_action :verify_authorized, unless: :skip_authorization?
```

with an explicit opt-out for the endpoints that legitimately use scoped queries
instead. That converts "we remembered every time" into "we cannot forget."
Add a request spec asserting that an unauthenticated and a wrong-owner request
gets 401/404 for every route, generated from `Rails.application.routes` — a
contract test that catches the whole class.

---

<a id="arc-06"></a>
### ARC-06 — No observability; abuse is undetectable while it is happening
**Severity: Medium** (**and a legal requirement — see §5**)

The entire monitoring stack is `ErrorLog` plus one Resend email per *new*
exception fingerprint (`app/jobs/error_alert_job.rb`, `error_log.rb:46-77`). The
design is clever and appropriate for its stated goal of avoiding a paid
third-party SDK, and the fingerprint dedup is well-implemented.

But it only sees **exceptions**. It cannot see:

- 10,000 failed admin login attempts (SEC-01) — those are clean 401 responses,
  not exceptions.
- A flood of `/client_errors` (SEC-04) — those are successful 201s.
- Rate-limit rejections — Rack::Attack returns 429 without raising.
- Sustained high latency, queue depth, memory pressure, or an outage.
- Anyone reading the admin API at all.

There are no metrics, no traces, no structured logs, no uptime check, and no
alerting on anything other than a novel exception.

Combined with §5's 72-hour breach-notification duty, "we would see it in the
error log" is not a detection strategy — it is the absence of one.

**Recommendation, in order:**

1. An external uptime monitor on `/api/v1/health` (free tier, 5 minutes of setup).
2. Structured JSON logs with `request_id` — `log_tags` is already set
   (`production.rb:54`), so the plumbing is half done — shipped somewhere
   queryable.
3. Counters and alerts for: auth failures per minute, admin 401s (any sustained
   rate is an incident), 429 rate, 5xx rate, Sidekiq queue depth.
4. Log every admin API request with the acting operator (blocked on SEC-01's
   per-operator identity).

---

<a id="arc-07"></a>
### ARC-07 — No data retention policy and no deletion path
**Severity: Medium** (**legal exposure — see §5**)

There is no account-deletion route in `config/routes.rb`. The only lifecycle
action is admin suspend, which `Admin::UsersController` documents as
deliberately never a hard delete. Nothing expires: chat messages and images,
addresses, mobile numbers, consumed `verification_challenges` rows (which hold
BCrypt digests of codes and the `sent_to` address), `error_logs` referencing
users, and `early_access_signups` all accumulate indefinitely.

This is simultaneously an architecture gap (unbounded growth, ever-larger breach
surface) and the DPA §11(e)/§16(e) compliance gap from §5.

**Recommendation:** implement anonymization-based erasure as described in §5,
plus scheduled purges: consumed/expired verification challenges after 30 days,
resolved error logs after 90, chat images after a stated period. Record the
retention decision as an ADR and mirror it in the privacy policy — the document
and the cron job must agree.

---

<a id="arc-08"></a>
### ARC-08 — Inconsistent invariant enforcement; concurrent checkout can oversell
**Severity: Low**

Two related observations.

**Inconsistency.** `Shop` enforces one-shop-per-vendor with a model validation
and an explicit comment that it is *"not a DB constraint (no concurrent-write
pressure yet at this scale)"* — a reasoned tradeoff. But `carts` enforces
one-active-cart-per-(customer, shop) with a partial unique index
(`schema.rb:90`), and `ratings` uses a unique index too (`schema.rb:272`, and
`docs/architecture.md` calls it "the actual backstop"). So the codebase has no
consistent rule about where invariants live. That is the finding — not either
choice individually.

**A real race.** `Carts::Checkout` re-validates stock (`carts/checkout.rb:30`)
and then creates order items inside a transaction (lines 39-46), but takes no
lock on the `items` rows. Two customers checking out the last unit concurrently
both pass the check and both succeed. Stock is also never decremented anywhere —
`stock_count` appears to be a vendor-maintained display signal rather than
enforced inventory, which may well be intentional, but if so the re-check at
checkout implies a guarantee it does not provide.

**Recommendation:** decide explicitly whether `stock_count` is authoritative. If
yes, `SELECT ... FOR UPDATE` the items in the checkout transaction and decrement
them. If no, document that it is advisory and soften the misleading
"unavailable items" error. Either way, write down the rule for where invariants
belong.

---

<a id="arc-09"></a>
### ARC-09 — No API contract for the planned Android client
**Severity: Low** · API9 (improper inventory management)

`CLAUDE.md` states the API "is built to serve [an Android client] without
changes," and `docs/open-decisions.md` item 10 confirms it will live in a
separate repo with an undecided stack. But there is no OpenAPI/JSON Schema
document, no generated client, and no contract test. Serializers are hand-rolled
plain modules (`app/serializers/*.rb`) — clear and readable, but the JSON shape
exists only as Ruby code and the request specs that happen to assert on it.

A team in a different repo, on a different stack, has nothing to build against
and no way to detect a breaking change until runtime. The "without changes"
claim is currently unverifiable.

**Recommendation:** generate an OpenAPI 3.1 document from the existing request
specs (rswag is the conventional Rails route) and publish it as a build
artifact. This costs little now and is the difference between the mobile repo
being able to start independently or not.

---

<a id="arc-10"></a>
### ARC-10 — Guest-cart merge on login is non-atomic and non-idempotent
**Severity: Low**

Per `docs/architecture.md` step 2 and `apps/customer-web/src/guestCart.ts`, the
anonymous localStorage cart is replayed into the backend on login **one
`addCartItem` HTTP call at a time**, then cleared.

A failure or a closed tab midway leaves a partially merged cart, with the local
copy either already cleared (silent item loss) or not (duplicate quantities on
retry, since `Carts::AddItem` *increments* an existing line rather than setting
it — `carts/add_item.rb:26`). There is no reconciliation.

**Recommendation:** add a single `POST /api/v1/cart/merge` taking the whole
guest cart, applied in one transaction with set-quantity rather than
increment-quantity semantics, and clear local state only on a 2xx.

---

## 7. Prioritized remediation roadmap

Ordered by impact × ease, not by severity. This is where an implementing agent
should start.

### Do right now — before anything else on this page

| # | Action | Closes |
|---|---|---|
| 0a | Set `VIPS_BLOCK_UNTRUSTED=1` in Railway (no rebuild, effective immediately) | SEC-00 |
| 0b | `bundle update rails --conservative` → 8.1.3.1, test, deploy | SEC-00 |
| 0c | Rotate every secret in the Railway environment | SEC-00 |
| 0d | `npm audit fix` in the three SPAs and `admin-mcp` (non-breaking) | §4.1 |

### Do this week — hours each, disproportionate payoff

| # | Action | Closes |
|---|---|---|
| 1 | Add a Rack::Attack throttle for `/api/v1/admin/*` | SEC-01 (partial) |
| 2 | Replace `ENV.fetch(k, "admin")` with `ENV.fetch(k)`; gate routes on both admin vars; document both in `.env.example` | SEC-02 |
| 3 | Check `user.status` in `authenticate!` and `find_verified_user`; revoke tokens on suspend | SEC-03 |
| 4 | Throttle `/client_errors` and `/feedback`; add `length: { maximum: }` across all models | SEC-04 |
| 5 | Add a password minimum length + common-password blocklist (mind `allow_nil: true`) | SEC-05 |
| 6 | Fix the `Rack::Attack.enabled` parenthesization | SEC-14 |
| 7 | `sanitize_sql_like` in the admin search paths | SEC-15 |
| 8 | Uncomment and populate `config.hosts` | SEC-13 |
| 9 | Run the SEC-07 curl test and act on the result | SEC-07 |

### Do this month — the structural fixes

| # | Action | Closes |
|---|---|---|
| 10 | Connect deploys to CI; tag images with the commit SHA | ARC-02 |
| 11 | Add Brakeman, bundler-audit, Dependabot, and frontend CI jobs | SEC-17 |
| 12 | Move admin-web to its own hostname; put Cloudflare Access in front | ARC-01, SEC-01 |
| 13 | Add security response headers; CSP in report-only mode reporting to `/client_errors` | SEC-10 |
| 14 | Enable `verify_authorized` with explicit opt-outs | ARC-05 |
| 15 | Uptime monitor + auth-failure and 429 alerting | ARC-06, §5 |
| 16 | Authenticated, expiring URLs for chat images; verify the R2 bucket is private | SEC-09 |
| 17 | Magic-byte validation, dimension caps, EXIF/GPS stripping on upload | SEC-08 |
| 18 | Confirm and test Postgres backup + restore; document RTO/RPO | ARC-03 |

### Before onboarding real neighbors — launch blockers

| # | Action | Closes |
|---|---|---|
| 19 | Legal review of `docs/legal/`; confirm the DPO and retention period | §5 |
| 20 | ADR + implementation for account deletion / anonymization | ARC-07, §5 |
| 21 | Written incident response plan with the 72-hour NPC notification path | §5 |
| 22 | Cable connection tickets; shorter token TTL + idle timeout | SEC-11, SEC-12 |
| 23 | Re-auth + old-address notification on email change | SEC-16 |
| 24 | **Turn `SKIP_VERIFICATION` and `VITE_SKIP_VERIFICATION` back off** | see below |

**On item 24.** `Vendors::EligibilityCheck#require_email_verification?`
(`vendors/eligibility_check.rb:39`) and the customer-web registration flow both
currently bypass verification via env toggles, documented in
`docs/open-decisions.md` item 12 as a temporary measure pending Semaphore's
sender-name approval. The toggles are well-implemented, clearly commented, and
individually reversible — this is a reasonable temporary call, not a mistake.
It is listed here only because temporary beta toggles are the single most
reliable thing to be forgotten, and the consequence is that **anyone can become
a vendor with an unverified email address**, which for a service premised on
neighbors trusting neighbors is a trust problem before it is a security one.
Set a calendar reminder, not just a note.

---

## 8. What was not audited

State these plainly. Do not let a reader infer coverage that does not exist.

- **No dynamic testing.** No running instance was probed. Every finding is from
  static reading. Findings marked **[VERIFY]** specifically require a live check.
- ~~No dependency CVE scan was executed.~~ **Done 2026-08-04 — see [§4.1](#41-dependency-scan-results-executed-2026-08-04).**
  It found CVE-2026-66066 (CVSS 9.5), which does indeed outrank every other
  finding, exactly as this section originally warned. Re-run both scanners
  before acting on this document; the advisory DB moves daily.
- **Cloud configuration is entirely outside the repo and was not reviewed:**
  R2 bucket policies and public-access settings, Railway environment variables
  and network configuration, Cloudflare DNS/WAF, Resend and Semaphore account
  settings, Postgres backup configuration. Several findings (SEC-08, SEC-09,
  ARC-03) cannot be fully closed without this.
- **Secret rotation history was not reviewed.** `git log -p` was not scanned for
  historically committed credentials. Worth doing with gitleaks.
- **Frontend components were sampled, not read exhaustively.** Auth, API client,
  and error-boundary code was read in all three SPAs. Individual page components
  were not, so client-side XSS sinks (`dangerouslySetInnerHTML`, unsanitized
  URL handling) have not been ruled out. Given SEC-01 and the absent CSP, **an
  XSS-focused pass over the customer SPA is the highest-value follow-up.**
- **No threat model or attack-tree exercise** was performed. This is a
  findings-based review, not a STRIDE analysis.
- **No load or resilience testing.** Findings about resource exhaustion (SEC-04,
  SEC-08) are reasoned, not measured.
- **`docs/product-handover.md` and `docs/milestones.md`** were treated as
  historical per `CLAUDE.md` and not audited for drift.

---

## 9. Appendix: verification commands

For the next agent. Run these before acting on the findings that depend on them.

```bash
# --- Confirm findings still apply at the current commit ---
cd apps/api

# SEC-03: should return exactly one hit, in authenticate_user.rb (login only)
grep -rn "suspended" app/services app/controllers/concerns

# SEC-04: should return nothing — no length validations anywhere
grep -rn "maximum:\|length:" app/models/

# SEC-05: should return nothing — no password validation
grep -rn "validates :password" app/models/

# ARC-05: should return nothing — no Pundit backstop
grep -rn "verify_authorized\|verify_policy_scoped" app/

# SEC-01: confirm no admin throttle exists
grep -n "admin" config/initializers/rack_attack.rb

# SEC-14: prints true, demonstrating the no-op
ruby -e 'test_env = true; p(ENV.fetch("RACK_ATTACK_ENABLED", !test_env.to_s) != "false")'

# --- Dependency scans: RUN on 2026-08-04, results in §4.1 ---
# Re-run before acting; the advisory DB updates daily.
gem install bundler-audit && bundle-audit check --update
# 2026-08-04: 1 finding — activestorage 8.1.3 / CVE-2026-66066 / CVSS 9.5 (SEC-00).

( cd ../customer-web && npm audit )   # 2026-08-04: 7 findings, all dev-only
( cd ../vendor-web   && npm audit )   # or unreachable — see §4.1 before
( cd ../admin-web    && npm audit )   # escalating on the severity labels
( cd ../../admin-mcp && npm audit )   # 2026-08-04: 1 moderate, unreachable
( cd ../../e2e       && npm audit )   # 2026-08-04: clean

# SEC-00: confirm the fix landed. Want rails/activestorage >= 8.1.3.1,
# and/or block_untrusted set as the interim mitigation.
grep -E "^    (rails|activestorage) " Gemfile.lock
grep -rn "block_untrusted" config/ ; echo "also check VIPS_BLOCK_UNTRUSTED in Railway"

# --- Still not run by this audit ---
gem install brakeman && brakeman -A --no-pager
gitleaks detect --source . --no-git=false   # history secret scan (SEC-17)
```

```bash
# SEC-07: is the rate-limit IP key spoofable? (run against production)
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST https://prisma.kapitmarket.ph/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 10.0.0.$i" \
    -d '{"email":"nobody@example.com","password":"x"}'
done
# Healthy: 429s appear from ~request 11. All 200/401: the key is spoofable.

# SEC-10: confirm the absent headers
curl -sI https://prisma.kapitmarket.ph/ | grep -iE \
  "content-security-policy|x-content-type|referrer-policy|permissions-policy|strict-transport"
# Expect: only strict-transport-security present.

# SEC-02: confirm the admin surface rejects the default credential
curl -s -o /dev/null -w "%{http_code}\n" -u admin:admin \
  https://prisma.kapitmarket.ph/api/v1/admin/users
# MUST be 401. Anything else is an active Critical incident — rotate immediately.
```

---

*Audit performed against commit `07d8342` on 2026-08-04. Findings are point-in-time; re-verify before acting.*
