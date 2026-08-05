---
name: production-incident-triage
description: >
  Draft runbook for triaging a "something's wrong/slow in production" report
  for this app (prisma.kapitmarket.ph, hosted on Railway — project id
  7afa3db2-76ba-45f7-811b-3c8edfbac6f4). Use this whenever the user reports
  the live site being slow, erroring, or behaving unexpectedly, before
  proposing a fix. Written 2026-08-05 from two real incidents in one session
  (a silent region drift, and a shop-list N+1 + Puma thread-pool issue).
  Draft status — expand this as new incident patterns show up.
---

# Production incident triage — your-local-marketplace-core

## Rule 1: get evidence before proposing a fix

Both real incidents today were confirmed with actual data before touching
any code — not guessed from "that seems like it could be it":

- The region-drift diagnosis came from Railway's GraphQL API (see
  Reference below), not from assuming.
- The N+1 diagnosis came from comparing real Railway HTTP logs for the slow
  endpoint against a comparably-loaded endpoint on the same deploy (2-4.2s
  vs. 300-800ms) — that comparison is what ruled out "it's just infra" and
  pointed at the endpoint's own query pattern instead.
- The thread-pool diagnosis came from the actual shape of the logs: response
  times climbing in a clean staircase across a burst of simultaneous
  requests is the specific signature of queuing for a limited resource, not
  of anything being individually slow. Confirmed further by checking
  `RAILS_MAX_THREADS` was genuinely unset and CPU/memory were nowhere near
  saturated (ruling out the resource-exhaustion explanation) before touching
  Puma config.

Don't skip straight to a fix. Pull the evidence first, then let the evidence
shape which of the checks below is actually relevant.

## Checklist

1. **Is it actually infra, or is it the app?**
   ```
   mcp__railway__environment_status   # all services healthy? recent deploy?
   mcp__railway__list_deployments     # anything FAILED recently?
   ```
   Compare where compute (`api`, `worker`) and data (`Postgres`, `Redis`)
   actually run — a redeploy can silently reset a service's region to
   Railway's default if it isn't pinned. This bit us once already; it's now
   pinned in `railway.json`, but check it hasn't drifted again on some other
   service, or after a `railway.json` change was reverted.

2. **Pull real HTTP logs for the slow/failing path, not just a hunch:**
   ```
   mcp__railway__get_logs  (log_type: "http", filtered to the path, status, or method)
   ```
   Look at actual durations across several requests, and compare against a
   comparably-loaded endpoint on the same deploy as a baseline. A flat
   "everything's slow" points at infra/region/thread-pool; a specific
   endpoint being slow while similar ones aren't points at that endpoint's
   own code (query pattern, missing eager-loading, N+1).

3. **Check resource headroom before blaming resources:**
   ```
   mcp__railway__service_metrics   # CPU/memory over the relevant window
   mcp__railway__list_variables    # is a relevant env var (e.g. RAILS_MAX_THREADS) even set?
   ```
   If CPU/memory are nowhere near saturated, "just scale up the service"
   isn't the fix — look at concurrency config or query efficiency instead.

4. **For a suspected N+1 or slow query**, reproduce locally with a real
   query count, not just a feeling:
   ```bash
   cd apps/api
   dotenv bin/rails runner "
     count = 0
     ActiveSupport::Notifications.subscribed(->(*_) { count += 1 }, 'sql.active_record') do
       # ...the actual code path...
     end
     puts count
   "
   ```
   (See `local-dev-setup` skill for why the `dotenv` wrapper matters here.)

5. **Verify any fix locally before deploying**: `dotenv bundle exec rspec`
   for the full suite, plus a before/after query count or timing if the fix
   is performance-related — don't just trust that a change "should" help.

6. **Flag decisions that need a human, don't make them silently.** Not
   every plausible optimization is a safe default change — e.g., switching
   Active Storage from redirect-through-Rails to public R2 URLs would help
   image load time further, but the same photo serializer also serves
   private per-order chat images, so it's an access-control decision, not a
   performance tweak. Surface these rather than resolving them yourself.

## Reference: querying Railway directly when the CLI/MCP path is short a tool

The bundled `railway-api.sh` GraphQL helper requires `jq`, which wasn't
installed in this environment. When that happens, query the GraphQL API
directly instead of stalling on the missing dependency:

```python
import json, subprocess
config = json.load(open('/home/armfrancisco/.railway/config.json'))
# token is NOT under config['user']['token'] in newer CLI versions —
# check the actual config shape first; project linkage was found under
# config['projects']['<repo path>']
```
Then `curl -s https://backboard.railway.com/graphql/v2 -H "Authorization: Bearer $TOKEN" -d '{"query": "...", "variables": {...}}'`.
Useful query for per-service region: `service(id: $id) { serviceInstances { edges { node { activeDeployments { meta { serviceManifest { deploy { multiRegionConfig } } } } } } } }`.

## Open — not yet captured here

- What "normal" baseline latency looks like for this app's key endpoints,
  so a future "is this actually slow" judgment call has a number to check
  against instead of a feeling.
- A repeatable way to reproduce production-shaped concurrent load locally
  (today's thread-pool fix was diagnosed from production logs alone, since
  local dev never has 15 concurrent requests hitting it).
