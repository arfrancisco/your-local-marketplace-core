# ADR 0006 — Image storage on Cloudflare R2

Status: accepted
Date: 2026-07-29

## Context

The app is image-heavy: shop photos, item photos, and — new in this phase —
image attachments in per-order chat. The API is intended to be hosted on
Railway, whose ephemeral/attached storage is not a good fit for durable user
media, and whose egress is not something we want to pay marketplace-image
traffic against.

We need durable, cheap, reliable object storage that Rails Active Storage can
target.

## Decision

Store all uploaded images on **Cloudflare R2**, via Active Storage's
S3-compatible service (R2 exposes an S3 API; configure a custom endpoint).

Reasons:

- **Zero egress fees.** For image browsing and image chat, egress is the cost
  that usually bites; R2 removes it.
- Cheap storage (~$0.015/GB/mo) and a free tier (~10 GB, ~1M requests/mo)
  likely covering this entire phase.
- S3-compatible, so it is a service-config choice, not a code lock-in.
  Swapping to another S3-compatible provider later is a credentials/endpoint
  change.

### Upload limits (enforced server-side before upload reaches R2)

Conservative defaults — easy to loosen later, costly to walk back after abuse:

- Allowed types: JPEG, PNG, WebP only (no GIF, no arbitrary types).
- Max size: 5 MB per image.
- Item photos: max 6 per item.
- Shop photos: max 3 per shop.
- Chat: max 1 image per message.
- Rate-limit upload endpoints per user.

## Consequences

- Railway hosts compute only; user media lives in R2, keeping the app tier
  stateless and Railway costs predictable.
- Local development can point Active Storage at the local disk service or a
  MinIO container, using R2 only in staging/production.
- The upload limits and allowed types must be enforced in the API layer, not
  just the clients, since the API also serves a future mobile client.
