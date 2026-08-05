---
name: ship-a-quick-fix
description: >
  The end-to-end loop for a small, well-scoped, low-risk change to this app
  (a copy tweak, a CSS fix, swapping one field for another, removing
  something broken) when the user says "one-shot this" or otherwise signals
  they want edit -> verify -> commit -> push -> deploy -> build log done in
  one pass with no pauses for confirmation in between. Written 2026-08-05
  after this exact loop repeated three times in one session with the same
  shape. Not for anything touching auth, payments, data deletion, migrations,
  or anything else genuinely risky — those still warrant the normal
  stop-and-check judgment.
---

# Ship a quick fix, one shot

## When this applies

The user describes a small, concrete UI/copy/style change (often from a
screenshot) and either says "one-shot this," "just do it," or has
established in-session that this exact loop (make the change, then commit +
push + deploy + build log) is the expected default for changes at this
scale. Don't ask "should I deploy now?" partway through — that defeats the
point of asking for one-shot in the first place. If something about the
change turns out to be more consequential than it looked (touches auth,
money, deletes data, needs a migration), stop and say so instead of
plowing through — one-shot is a scope contract, not a blank check.

## The loop

1. **Make the change.** Find the actual source (don't guess — grep for the
   literal text/class name if unsure which file owns it), edit it, and grep
   for any other place the same thing is referenced (tests, other apps,
   CSS classes that might collide — see `feedback_css_specificity_overrides`
   memory) so nothing is left half-updated.

2. **Verify before committing, not after:**
   ```bash
   cd apps/customer-web   # or vendor-web / admin-web / apps/api
   npx tsc -b && npm test -- --run     # frontend
   dotenv bundle exec rspec            # backend — needs the dotenv wrapper,
                                        # see local-dev-setup skill
   ```
   If a test fails, check whether it's actually related to your change
   before assuming it's a regression — this session hit two real flaky/
   pre-existing failures that had nothing to do with the change in flight.
   Re-run in isolation to tell the difference.

3. **Commit** with a message explaining *why*, not just what changed (see
   the repo's own commit-message conventions — this project's messages lean
   on context: what was broken/redundant, why this is the fix, not just
   "update X").

4. **Push:**
   ```bash
   git push origin main
   ```
   If this is blocked by the auto-mode classifier with a "Stage 2
   classifier error... usually transient" message, just retry once — it
   resolved on retry every time it happened this session.

5. **Deploy** the `api` service (it serves the built customer-web/vendor-web/
   admin-web static assets via the Dockerfile's multi-stage build — a
   frontend-only change still means redeploying `api`, not a separate
   frontend service):
   ```
   mcp__railway__deploy(project_id, service_id: <api>, path: repo root, message: <same as commit>)
   ```
   Only also deploy `worker` if the change touches backend/shared code the
   Sidekiq process could run (models, services) — a pure frontend change
   doesn't need it.

6. **Confirm it landed** — don't just fire the deploy and move on:
   ```
   mcp__railway__environment_status   # SUCCESS, not BUILDING/FAILED
   curl -s -o /dev/null -w "%{http_code} (%{time_total}s)\n" https://prisma.kapitmarket.ph
   ```
   If it's still building, this is a good moment for `ScheduleWakeup`
   rather than sitting there — check back in ~90s.

7. **Add to the Notion Build Log** (page id `3ac52229-fba0-8187-a136-eb084b1ba05b`,
   "Build Log," reverse-chronological — today's entry is usually already
   open, so `update_content` to append a new `###` subsection under it
   rather than starting a fresh `##` day-entry for a same-day follow-up).
   A sentence or two: what was wrong, what changed, why — matching this
   doc's established narrative-prose style, not a bare changelog line.

## What "one-shot" does not skip

- Real verification (step 2) — speed comes from not pausing to ask
  permission at each step, not from skipping the step that catches
  mistakes before they're live.
- Confirming the deploy actually succeeded (step 6) — "I ran the deploy
  command" and "it's live" are different claims; only say the second once
  you've checked.
