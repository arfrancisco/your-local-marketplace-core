---
name: ship-it
description: >
  The commit -> push -> deploy -> confirm -> build-log sequence for this
  app, triggered when the user says "ship it" (or a clear equivalent —
  "let's ship", "good, ship it", "all good, ship") after work has already
  been implemented and verified earlier in the session, regardless of how
  large the change was. Distinct from ship-a-quick-fix, which bundles
  making a small change AND shipping it into one uninterrupted loop; this
  skill is just the shipping half, used once the work is already done,
  tested, and the user has given the explicit go-ahead. Written 2026-08-06.
---

# Ship it

## When this applies

The user says "ship it" or a clear equivalent, after work earlier in the
session has already been implemented and verified (tests passing, `tsc`
clean, manual/e2e check done). This is the go-ahead to make it real:
commit, push, deploy, confirm, log.

Don't use this skill to decide *whether* to ship — that's the user's call,
signaled by the trigger phrase itself. But if the change was never actually
verified in this session (no test run, no manual check), say so before
proceeding — "ship it" is a request to stop pausing between already-verified
steps, not a request to skip verification that never happened.

## The sequence

1. **Review what's actually changed** before staging — don't blindly
   `git add -A`:
   ```bash
   git status
   git diff --stat
   ```
   Confirm nothing unexpected is in the working tree (stray debug/scratch
   scripts, unrelated changes from earlier in the session, temp files under
   `e2e/` from manual verification passes).

2. **Commit** with a message explaining *why*, not just what changed —
   this repo's stated convention (CLAUDE.md). Stage specific files, not
   `-A`. If the change is large/multi-part, one commit per coherent piece
   is fine, but don't let unrelated work ride along in the same commit.

3. **Push:**
   ```bash
   git push origin main
   ```
   A "Stage 2 classifier error... usually transient" block from the auto-mode
   classifier is safe to retry once.

4. **Deploy.** This repo's Dockerfile builds all three frontends
   (customer-web, vendor-web, admin-web) into the `api` service's static
   assets — a frontend-only change still means redeploying `api`, not a
   separate frontend service. Only also deploy `worker` if the change
   touches backend/shared code the Sidekiq process could run (models,
   services).
   ```
   mcp__railway__deploy(project_id, service_id: <api>, path: repo root, message: <commit message>)
   ```

5. **Confirm it actually landed** — "I ran the deploy command" and "it's
   live" are different claims; only report the second once checked:
   ```
   mcp__railway__environment_status   # SUCCESS, not BUILDING/FAILED
   curl -s -o /dev/null -w "%{http_code} (%{time_total}s)\n" https://prisma.kapitmarket.ph
   ```
   Still building? Use `ScheduleWakeup` to check back in ~90s rather than
   sitting there polling synchronously.

6. **Log it** in the Notion Build Log (page id
   `3ac52229-fba0-8187-a136-eb084b1ba05b`, "Build Log," reverse-chronological)
   — a sentence or two on what shipped and why, matching the doc's
   established narrative-prose style. Append under today's existing entry
   (`update_content`) if one's already open, rather than starting a fresh
   day-entry for a same-day follow-up.

## What this skill does not cover

- **Deciding whether the change is safe to ship at all** — that's a
  judgment call made before this skill triggers, not inside it.
- **Anything genuinely risky** (auth, payments, data deletion, migrations)
  — those still warrant the normal stop-and-check treatment even after
  "ship it," per the global executing-actions-with-care guidance. If the
  diff touches one of these, say so and confirm before proceeding rather
  than treating "ship it" as blanket authorization.
- **Making the change itself** — see `ship-a-quick-fix` for the bundled
  edit-and-ship loop used on small, well-scoped changes made in the same
  pass they're shipped.
