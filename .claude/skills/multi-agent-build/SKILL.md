---
name: multi-agent-build
description: >
  Build an approved implementation plan (from Plan Mode, or any written plan
  the user has signed off on) by decomposing it into independent chunks and
  dispatching multiple Agent calls in parallel, rather than writing the
  whole thing serially as one agent. User's standing preference, stated
  2026-08-11: "I always want a plan to be built by multiple agents as
  necessary instead of just one." Applies whenever a plan has 2+ genuinely
  independent chunks — not a mandate to parallelize a one-file fix (see
  ship-a-quick-fix for that case).
---

# Build a plan with multiple agents

## When this applies

A plan has just been approved (Plan Mode's `ExitPlanMode`, or the user
otherwise signs off on a written plan) and it's time to actually write the
code. Default to decomposing the work and dispatching parallel `Agent`
calls for the independent chunks, instead of working through the whole
plan yourself in one long serial pass. This mirrors how the review panel
(`chief-of-staff`) already dispatches specialists in parallel for review —
same idea, applied to building.

Skip this for genuinely small plans (one file, or a tightly sequential
chain with no real parallelism available) — decomposing a 20-minute change
into agent dispatches is overhead, not speed. The trigger is "the plan has
independent chunks," not "a plan exists."

## Step 1: Map the dependency graph before dispatching anything

Read the plan and sort its pieces into two kinds:

- **Hard sequential dependencies** — a migration must exist and run before
  a model can reference the new column; a model must exist before a service
  that uses it; a backend route/controller must be stable (the plan already
  specifies its exact shape) before frontend code can be *meaningfully
  tested against a real server*, though frontend code can usually be
  *written* in parallel against the plan's documented contract, then
  integration-tested once the backend chunk lands.
- **Genuinely independent chunks** — different apps (customer-web vs.
  vendor-web are separate directory trees, separate build systems, rarely
  share files), docs updates, anything that doesn't read or write a file
  another chunk also touches.

Migrations specifically are **never** a parallel chunk on their own — Rails
migration timestamps and `schema.rb` are shared, order-sensitive state.
Always do migrations first, as a single agent (or yourself directly if
trivial), before anything that depends on the resulting schema.

## Step 2: Group into agent-sized chunks

Reasonable default split for a typical full-stack Rails+React plan in this
repo:

1. **Backend, foundation** (migrations + models) — first, alone, blocking
   everything else that touches the DB.
2. **Backend, services/jobs/controllers** — once the schema exists. Can
   often split further (e.g. one agent for a new job + its extraction from
   an existing file, another for a new service) if the plan's file list
   shows them as genuinely disjoint.
3. **Frontend, per app** — customer-web and vendor-web as separate parallel
   agents once the API contract is fixed (it's already fully specified in
   an approved plan, so this can usually start in parallel with #2, not
   strictly after it).
4. **Docs** — independent of all of the above, dispatch any time.

Each chunk's agent should write its own tests alongside its own
implementation (tightest feedback loop — don't split "write the code" and
"write its tests" across two agents that then have to coordinate).

## Step 3: Dispatch in parallel, with isolation

For chunks running at the same time, use `Agent` with `isolation:
"worktree"` by default — even when directories are believed disjoint, a
worktree removes any risk of two agents' writes racing on the same working
tree, and costs little (the tool auto-cleans up if an agent makes no
changes). Reserve same-tree, no-isolation dispatch for chunks that are
already guaranteed not to overlap in time (e.g. frontend work started only
after the backend foundation chunk has already finished and merged).

Brief each agent like the Agent tool's own guidance demands: what the
overall feature is and why, the exact piece they own, the plan's relevant
section verbatim (file paths, exact field names, message copy, whatever
the plan already nailed down — don't make them re-derive decisions the
plan already settled), and what "done" looks like (tests passing, `tsc -b`
clean, etc.).

Track chunks with `TaskCreate`/`TaskUpdate` so progress is visible as
agents report back.

## Step 4: Integrate and verify as one pass

Once parallel agents finish (worktree agents return a branch/path in their
result):

1. Merge each worktree branch back into the working branch, resolving any
   conflicts.
2. Run the **full** verification suite yourself, once, across the
   integrated result — `dotenv bundle exec rspec`, `tsc -b` + tests in
   both frontend apps. Don't trust each agent's individual partial
   verification as sufficient; the point of this step is catching anything
   that only breaks once the pieces are combined.
3. Only then report the plan as built.
