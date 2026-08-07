# Daily lesson + quiz log

Progress tracker for the curriculum in `docs/curriculum/`.

**Schedule:** weekdays, 9:00 AM Philippine time (01:00 UTC, Mon-Fri).
**Cadence:** learn first, then get quizzed on it.

- **Day 1** — Lesson 1 is delivered. No quiz (nothing learned yet).
- **Day N** — 6-question quiz on **lesson N-1**, then lesson N is delivered.
- **After lesson 11** — mixed review, 6 questions per day drawn across all
  lessons, weighted toward whatever is `shaky` below.

Questions come mostly from the lesson text, with the occasional "open this
file and tell me what it does" question against the live code, so the
material stays honest as the codebase changes.

Nothing here needs hand-editing, but feel free.

## Mastery

`-` = not yet quizzed. Confidence: `solid` (5-6 correct), `ok` (3-4),
`shaky` (0-2).

| # | Lesson | Taught | Quizzed | Score | Confidence |
|---|---|---|---|---|---|
| 1 | Product and its three refusals | 2026-08-06 | 2026-08-07 | 6/6 | solid |
| 2 | Shape and shipping | 2026-08-07 | - | - | - |
| 3 | Identity and authentication | - | - | - | - |
| 4 | Authorization | - | - | - | - |
| 5 | Data model and the snapshot rule | - | - | - | - |
| 6 | Discovery | - | - | - | - |
| 7 | Cart and checkout | - | - | - | - |
| 8 | Order lifecycle | - | - | - | - |
| 9 | Chat, payment, ratings | - | - | - | - |
| 10 | Operations surface | - | - | - | - |
| 11 | Pre-beta review | - | - | - | - |

## Session log

Newest first.

<!-- Each session appends an entry in this shape:

### 2026-08-07 — Quiz: lesson 1 · Taught: lesson 2
Score 5/6 on lesson 1. Confidence: solid.
- Missed: why image limits live in the model layer (said "security" rather
  than "a future Android client hits the same API").
- Carry forward to the next mixed-review round.

-->

### 2026-08-07 — Quiz: lesson 1 · Taught: lesson 2

Score 6/6 on lesson 1. Confidence: solid.
- No misses. Correctly answered the addresses-schema recall, the ADR 0009
  reframe, the unpaid-order scenario, the live-code FULFILLMENT_METHODS
  question (both models, both `pickup`/`delivery`), the ImageAttachable
  "cannot be trusted" reasoning, and the preparing-fork state machine
  question.
- Delivered lesson 2 in full: the four-apps-one-image-one-service shape,
  the Dockerfile build-context and VITE_* bake-in traps, the routing trap
  (ordering + RESERVED_PATH_PREFIXES, and the actual production incident it
  caused), the social-preview crawler special case, the manual `railway up`
  deploy with no CI/CD, and the CI path-filter gap (frontend PRs get no
  automated checks).

### 2026-08-06 — Taught: lesson 1

No quiz (Day 1, nothing taught yet to quiz on). Delivered lesson 1 in full:
the three refusals (no geo, no payment gateway, no courier) and the
"rules live in the API" corollary, with the ADR 0002 four-layer trace and
the three misconceptions.

## Next up

**Day 3 — quiz on lesson 2** (6 questions), then **lesson 3 — identity and
authentication.**
