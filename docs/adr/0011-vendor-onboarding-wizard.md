# ADR 0011 — Vendor onboarding wizard, superseding the informational splash

Status: accepted
Date: 2026-08-21

## Context

`OnboardingPage.tsx` currently carries this comment on the component itself:

> A static, informational splash — not a state machine. [...] Each real page
> (ShopFormPage, ShopDashboardPage, ShopPreviewPage, ItemsPage,
> OrderDetailPage) owns its own optional, on-demand tour behind a "?" button
> (HelpTourButton) instead of this page forcing anyone through a guided
> sequence.

That was a deliberate call at the time: four bullet points explaining how the
app differs from a typical online store (no in-app payment, button-driven
order status, per-order chat, shops as an ongoing thing not a one-time sale),
then a single "Get started" link to `/shops/new`. From there a vendor was on
their own, discovering shop setup, photos, item creation, and payment
messaging by wandering between pages and, if they wanted it, opening a "?"
tour on each one.

In practice this produced shops that opened with no items, no payment
message, or both — a shop a customer could find but not usefully order from.
The gap wasn't a missing feature so much as a missing sequence: nothing told
a first-time vendor what order to do things in, or that skipping the payment
message meant orders nobody could pay for.

## Decision

Reverse the splash-only approach. Onboarding becomes a real guided wizard for
first-time setup. The per-page "?" tours are unchanged and stay in place —
they now serve a returning vendor revisiting a page on their own terms, while
the wizard owns the first-run path.

- **Four counted steps**: shop basics, photos, first item, payment message.
  The welcome splash still exists but is **not** counted — progress reads
  "Step 1 of 4" starting at shop basics. The splash is read-only and cannot
  be failed or gotten wrong, so counting it would inflate the perceived
  length of the wizard for no benefit.
- **Progress is `shops.onboarding_step`, a string**, validated against
  `Shop::ONBOARDING_STEPS = %w[shop photos items payment]` — meaning "the
  step to resume at." A named string constant rather than an integer index,
  so inserting or reordering a step later doesn't silently reinterpret rows
  that already have a stored value.
- **Completion is a separate column**, `shops.onboarding_completed_at`, not
  derived from `onboarding_step == "payment"` (the last step). Deriving it
  from the step value breaks the moment a step is added, removed, or
  reordered — every existing shop's stored step would suddenly mean
  something different. Existing shops are backfilled as complete on
  migration, since they predate the wizard and already went live under the
  old splash-only flow.
- **The shop row is created at the end of step 1** (shop basics), not at the
  end of the whole wizard. This is safe without any new mechanism: `status`
  already defaults to `"draft"` and `accepting_orders` to `false`, and
  customer discovery only ever surfaces `Shop.listed`
  (`where(status: "active", accepting_orders: true)`). A half-built shop
  sitting mid-wizard is already invisible to customers.
- **`Shop#open!` now requires an `opening_message` present and at least one
  enabled item**, in addition to its existing checks. This ties directly to
  ADR 0009: the opening message *is* the payment mechanism, so a shop that
  opens without one produces orders nobody can pay for. An empty open shop
  also silently consumes a slot in ADR 0007's daily rotation with nothing in
  it to buy.
- **The dashboard's existing open/close toggle stays independent of
  onboarding completion.** Opening a shop from the dashboard does not itself
  mark onboarding complete, and finishing the wizard does not itself open
  the shop — they are two different signals (one is "ready to sell right
  now," the other is "walked through setup once"). The consequence is worth
  stating plainly: a shop can be open for business while the wizard's setup
  banner is still showing, so that banner's copy has to allow for "you're
  live, and here's what's still unfinished" rather than asserting the shop
  is invisible.
- **The wizard reads live data rather than keeping its own copy of
  progress.** The bottom tab bar stays visible during onboarding (per the
  bottom-tab-bar-parity work already shipped for vendor-web), so a vendor
  can legitimately leave the wizard mid-flow, add items from the Inventory
  tab, and come back — the wizard has to reflect that, not overwrite it with
  stale local state.
- **`onboarding_step` records the furthest step reached and never regresses**
  on Back navigation. Paging backward to review or edit an earlier step
  doesn't reset progress.

### Alternatives considered

- **Integer step index** instead of a named string constant — rejected.
  Reordering or inserting a step silently reinterprets every stored integer
  as a different step; a string checked against a named list fails loudly
  instead (an unrecognized string is invalid, an unrecognized integer is
  just a different valid-looking step).
- **Deriving completion from the step value** (`onboarding_step == last`)
  instead of a separate timestamp — rejected for the same reason: it breaks
  every already-stored row the day a step is added, removed, or reordered.
- **Deriving resume position from existing data** (e.g. "no photos yet"
  implies resume at the photos step) instead of an explicit column —
  rejected. Photos are legitimately skippable; a shop with no photos might
  have deliberately skipped that step and moved on, not failed to reach it.
  Absence of data doesn't reliably mean "not reached."
- **localStorage-only progress** instead of a persisted column — rejected.
  Vendors arrive at onboarding via a cross-app redirect from customer-web's
  "become a vendor" flow, a different origin's local storage, so any
  progress tracked only in the browser would already be lost on arrival.

## Consequences

- Two new columns on `shops`: `onboarding_step` (string) and
  `onboarding_completed_at` (nullable datetime). Both are additive; no
  existing relationship changes, so this doesn't touch `docs/erd.md`'s
  entity diagram.
- `Shop#open!`'s stricter precondition is a behavior change for any vendor
  who previously opened a shop with no items or no payment message — that
  path now raises until both are in place. Existing open shops that already
  violate this (opened before the check existed) are not retroactively
  closed; the check only applies going forward, at the next `open!` call.
  This is not hypothetical: at the time of writing, all three real shops on
  production would fail the gate (two of them currently open with zero
  items). So the reasons are exposed as `Shop#open_blockers` and rendered as
  a readiness card on the dashboard, with a link to the page that fixes
  each. Without it, a vendor who closes for a night and cannot reopen would
  meet the rule for the first time as an error inside a modal.
- Finishing onboarding and being able to open are deliberately separate
  states, so a shop can be onboarding-complete and still blocked. That is
  reachable two ways: the migration backfills every pre-wizard shop as
  complete, abandoned signups with no items included; and a live vendor can
  disable or archive their whole catalogue at any time. The readiness card
  above is what covers both, since the setup banner is keyed to onboarding
  and is long gone by then.
- `onboarding_step`'s forward-only rule is enforced in the model
  (`Shop#keep_onboarding_step_moving_forward`), not just by the wizard. The
  client's own check runs against whatever shop snapshot one browser tab
  holds, so two tabs or out-of-order responses could otherwise walk it
  backwards. It is a property of the column, not of one screen.
- The per-page "?" tours (`HelpTourButton`) are unchanged in code and intent
  — they remain the on-demand path for a vendor who already has a shop and
  wants a refresher on one specific page, not the first-run path.
- A vendor can still reach `/shops/new` directly (deep link, browser back,
  bookmark) without going through the wizard's welcome splash; the wizard's
  step tracking is keyed off the shop row's own state once it exists, not
  off having necessarily seen the splash first.
