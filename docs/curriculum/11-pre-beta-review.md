# Lesson 11 — Pre-beta review

> Part 11 of 11. Previous: [The operations surface](10-ops-surface.md) · Back to the [syllabus](README.md)

## Why this matters

The other ten lessons taught you the system. This one is a punch list. It
collects everything found while writing the curriculum that is either
**wrong in the docs**, **temporarily switched off**, or **undecided** — the
three categories that bite hardest in a beta's first week, because each one
is a thing you will believe is true when it is not.

Read it, then decide what to act on. Some of it is a five-minute doc edit;
some of it is a product call only you can make.

## Part A — Documentation drift

The repo has good documentation and some of it has gone stale. The pattern
is consistent: **the reasoning aged well, the mechanics did not.**

### The scoreboard

| Doc | Status |
|---|---|
| `CLAUDE.md` | **Current.** Trust it. |
| `docs/architecture.md` | **Current.** Trust it. |
| `docs/adr/*` | Reasoning authoritative; **0003 and 0009 have stale mechanics** |
| `README.md` | **Stale** — describes the pre-cart, pre-admin build |
| `docs/erd.md` | **Stale** — frozen at the original M0-M4 plan |
| `docs/milestones.md` | Historical by declaration; fine |
| `docs/product-handover.md` | Historical by declaration; fine |
| `db/schema.rb`, the code, `spec/` | **Always true** |

### The specific drifts

**`README.md`** lists as "deliberately not built yet": shopping cart, order
edits, admin interface, inventory counts. All four exist in some form — a
real cart (ADR 0008), vendor-only order item edits, admin-web plus
admin-mcp, and `stock_count` on items. It also describes orders as "placed
directly against a single item rather than assembled in a cart."

**`docs/erd.md`** — four separate errors:
- Lists `carts` / `cart_items` as deferred. They exist.
- Says item photos max 6. The code says 3
  (`has_images :photos, max_count: 3`).
- Describes shop photos as a generic multi-photo bucket. Replaced by
  `profile_photo` (1), `cover_photo` (1), and `opening_message_photos` (5).
- Heads the orders section "cart-free direct placement."

**`docs/adr/0003`** documents `POST /orders` taking `shop_id`, `item_id`,
`quantity`. **That route does not exist.** Orders come from
`POST /cart/checkout`. The state machine in the same ADR *is* current.

**`docs/adr/0009`** says the payment message and QR auto-post as the first
chat message at checkout. The code creates an empty conversation and reads
the panel live in `OrderSerializer`, marked "ADR 0009, revised" in the
comments. The revision is the better design (lesson 5); only the ADR text
was left behind.

**`routes.rb`** comments customer discovery as "Authenticated." It is
public — `ShopsController` calls `skip_before_action :authenticate!`. This
one matters more than it looks: the guest cart exists *because* browsing is
anonymous.

**`static_controller.rb`** says admin-web logs in with HTTP Basic. That was
true before ADR 0010; it is bearer tokens now.

### What to do

Cheap and worth doing before beta: fix the `README.md` scope table, add a
"superseded mechanics" note to ADRs 0003 and 0009, correct the two
`routes.rb`/`static_controller.rb` comments.

`docs/erd.md` is the judgment call — either regenerate it from
`db/schema.rb` or stamp it historical the way `milestones.md` already is.
Half-updating it is the worst option, because a partially-correct schema doc
is more dangerous than an openly historical one.

## Part B — Flags currently set to non-default values

### Verification is off, end to end

Two flags, both temporary, pending Semaphore's custom Sender Name approval
(their stated turnaround is up to 5 business days with no expedited option,
and there is no confirmation yet that it cleared).

**`SKIP_VERIFICATION=true`** (API, Railway env var, no rebuild needed).
Removes the email-verified requirement to become a vendor.

**`VITE_SKIP_VERIFICATION=true`** (customer-web). Skips the
mobile-verification screen during registration. **Baked in at Docker build
time**, so reversing it needs a frontend rebuild and redeploy, not an env
var change.

The consequence to be clear-eyed about: `Carts::Checkout`'s **first gate**
is `email_verified?`. With verification off, **an account with an
unverified, possibly non-existent email address can place a real order.**
At neighbor scale where the vendor will physically meet the customer, that
is a defensible trade. It is still worth knowing that it is the trade you
made, and that spam or a typo'd email produces an order the vendor cannot
follow up on outside the app's own chat.

### Other environment-dependent behavior

| Flag | Effect if unset/false |
|---|---|
| `ADMIN_ENABLED` | The entire admin namespace is **not drawn** — 404, not 403 |
| `RACK_ATTACK_ENABLED=false` | **All rate limiting off**, including auth and verification |
| `SIDEKIQ_WEB_USERNAME`/`PASSWORD` | `/sidekiq` is not mounted at all |
| `RESEND_API_KEY`, `EMAIL_FROM_ADDRESS`, `FEEDBACK_NOTIFICATION_EMAIL` | Error and feedback emails silently do not send |

That last row deserves attention: `ErrorAlertJob` returns early on blank
config **and** on any non-production environment. Both are correct
behaviors, and together they mean "I am not getting error emails" has at
least three plausible causes — not production, blank config, or a
fingerprint that is not new.

**Action:** verify what is actually set on the Railway service before
launch. Every item above changes user-facing or operator-facing behavior.

## Part C — Product decisions still open

`docs/open-decisions.md` lists nine. Its own framing is right: none of these
are engineering work. Three have teeth for a beta.

### Cancellation policy (#3) — the sharpest one

Today, **nobody can cancel an order once the vendor moves it to
`preparing`** (lesson 8). Not the customer, not the vendor. That is not a
ratified policy; it is what the transition table happens to say.

You will hit this in week one. A customer will want to cancel while food is
being cooked, and the app's answer will be a 422. Decide now whether that
is the intended behavior, and if not, whether the escape hatch is a
vendor-approved cancel, a wider cancel window, or a manual admin action.

### Vendor verification (#5)

`vendor_profiles.verification_status` exists. **Nothing gates shop creation
on it.** Anyone who can register can publish a shop and take orders. For a
closed pilot among known neighbors that is fine; the question is whether
anything enforces "known neighbors."

### Notification channels (#7)

With SMS verification disabled and no push, the only notification channel is
**in-app chat plus the unread badge**. A vendor who does not open the app
does not learn an order arrived. For a pilot where you can tell vendors
"check the app," workable. Worth stating explicitly rather than discovering.

The other six — pilot location, fulfillment mode, order-edit approvals,
rating direction, currency/tax/receipts, multi-shop vendors — are real but
less likely to bite in the first week.

## Part D — Operational risks

**1. Manual deploys, no pipeline.** `railway up --service api
--path-as-root . --detach` from the repo root is the only path to
production. The known failure mode — the live site running days-old code
while commits kept landing — has already happened. Mitigation is a habit,
or a `/up` version check, or connecting the Railway source.

**2. CI does not cover the frontends.** The PR trigger is filtered to
`apps/api/**`. Three Vitest suites and a Playwright e2e suite exist and
never run automatically. A frontend-only PR gets zero checks. Fixing this
is a small workflow change and probably the highest value-per-minute item
on this list.

**3. No payment reconciliation.** `marked_paid` is a vendor's assertion.
There is no dispute flow beyond the chat log and admin read access. This is
by design (ADR 0009) and permanent — the risk is not that it is wrong, but
that nobody has written down what you *do* when a neighbor disputes a
payment. Decide the human process before you need it.

**4. One shop per vendor is a soft constraint.** A model validation with no
DB uniqueness index. Racy under concurrency, which the comment acknowledges
as acceptable at this scale.

**5. Search does not scale, on purpose.** `ILIKE '%term%'` cannot use an
index. Fine for dozens of shops, not for thousands. Noted, not a problem
today.

**6. The rotation's `count` is per result set.** `ShopRotation` takes the
modulus over the shops in *this* list, so a filtered search rotates modulo
the filtered count. Fairness still holds within a list; just do not expect
a filtered order to be a subsequence of the unfiltered one.

## The pre-beta checklist

Concrete, in rough priority order:

- [ ] Confirm which env vars are actually set on the Railway service —
      especially `SKIP_VERIFICATION`, `ADMIN_ENABLED`, `RACK_ATTACK_ENABLED`,
      and the Resend trio.
- [ ] Decide the cancellation policy (open decision #3). It will come up.
- [ ] Add frontend tests and e2e to CI, or accept and write down that they
      are manual.
- [ ] Confirm the deployed commit matches `main` before launch, and after
      every fix.
- [ ] Bootstrap the first `AdminUser` (`admin_users:create`) and verify
      admin-web login works in production.
- [ ] Verify error alerting end to end — trigger a new fingerprint in
      production and confirm the email lands.
- [ ] Fix or stamp the stale docs (Part A), at minimum `README.md` and the
      two ADR mechanics notes.
- [ ] Write down the human process for a disputed payment.
- [ ] Decide how vendors learn a new order arrived, given no push or SMS.
- [ ] Check the legal drafts in `docs/legal/` — both are marked as needing
      lawyer review before go-live.

## Exercises

**1.** Name three things `README.md` says are unbuilt that are built.

<details><summary>Answer</summary>

Any three of: the cart (ADR 0008), the admin interface (admin-web +
admin-mcp), inventory counts (`stock_count`), and order edits (vendor-only
`PATCH /orders/:id/items`).
</details>

**2.** `SKIP_VERIFICATION` is on. Which user-facing gate opens, and which of
the two flags cannot be reversed with an env var change?

<details><summary>Answer</summary>

It removes the email-verified requirement — which is `Carts::Checkout`'s
first gate, so unverified accounts can place real orders — and also the
requirement to become a vendor. `VITE_SKIP_VERIFICATION` is the one baked
into the bundle at Docker build time, so reversing it requires a rebuild
and redeploy.
</details>

**3.** A customer wants to cancel an order in `preparing`. Bug, feature, or
open decision?

<details><summary>Answer</summary>

Open decision (#3). The code makes it impossible because `preparing` only
transitions to the two fulfillment states — a default that follows from the
transition table, not a policy anyone ratified.
</details>

**4.** You are not receiving error alert emails in production. List the
plausible causes in the order you would check them.

<details><summary>Answer</summary>

1. The fingerprint is not new — repeats never alert, by design; check
   `occurrences_count` and `first_seen_at`.
2. One of `RESEND_API_KEY` / `EMAIL_FROM_ADDRESS` /
   `FEEDBACK_NOTIFICATION_EMAIL` is blank, so the job returns early.
3. `Rails.env` is not production (should not apply on Railway, but the guard
   exists).
4. Sidekiq is not processing — check Redis and `/sidekiq`.
5. The error is not reaching `ErrorLog.record!` at all — verify a row exists
   in Error logs before blaming email.
</details>

**5.** Which two docs in this repo are current, and what is authoritative
when everything disagrees?

<details><summary>Answer</summary>

`CLAUDE.md` and `docs/architecture.md`. When anything disagrees:
`db/schema.rb` for the schema, the code for behavior, and `spec/requests/`
for the API contract.
</details>

## Recap

- **Docs drift in a pattern**: reasoning stayed good, mechanics went stale.
  `README.md` and `docs/erd.md` describe the pre-cart build; ADRs 0003 and
  0009 have superseded mechanics; two code comments are wrong about auth.
- **Verification is off end to end** for the beta, which means an
  unverified email can place an order — a defensible trade at neighbor
  scale, but a deliberate one. `VITE_SKIP_VERIFICATION` needs a rebuild to
  reverse.
- **Four env vars change behavior invisibly**: `ADMIN_ENABLED`,
  `RACK_ATTACK_ENABLED`, the Sidekiq Basic Auth pair, and the Resend trio.
- **Cancellation policy is the open decision most likely to bite** — today
  nobody can cancel after `preparing`, and nobody chose that.
- **Two operational gaps worth closing**: no CI on the frontends, and a
  manual-deploy habit with a known failure mode.
- Everything else on the list is real but survivable for a pilot, as long
  as it is written down rather than discovered.

---

You have finished the curriculum. Back to the [syllabus](README.md), or use
`docs/codebase-guide.md` as the condensed reference from here.
