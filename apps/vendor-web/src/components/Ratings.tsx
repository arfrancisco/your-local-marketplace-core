import type { Rating } from '../api/types'

// Read-only review display for vendors. Its own copy rather than a shared
// package (ADR 0001) — same reason customer-web keeps its own.

export function Stars({ score }: { score: number }) {
  const filled = Math.round(score)
  return (
    <span className="stars" aria-label={`${score} out of 5`}>
      {'★'.repeat(filled)}
      {'☆'.repeat(Math.max(0, 5 - filled))}
    </span>
  )
}

// Never renders "★ 0" for an unrated shop — the API sends a null average
// rather than 0, so an absent score stays distinguishable from a bad one.
export function RatingSummary({
  averageRating,
  ratingsCount,
  emptyLabel,
}: {
  averageRating: number | null
  ratingsCount: number
  emptyLabel?: string
}) {
  if (ratingsCount === 0 || averageRating === null || averageRating === undefined) {
    return emptyLabel ? <span className="muted">{emptyLabel}</span> : null
  }
  return (
    <span className="rating-summary">
      ★ {averageRating.toFixed(1)} · {ratingsCount} review{ratingsCount === 1 ? '' : 's'}
    </span>
  )
}

export function RatingList({ ratings }: { ratings: Rating[] }) {
  return (
    <ul className="list">
      {ratings.map((rating) => (
        <li key={rating.id} className="card review">
          <div className="row spread">
            <strong>{rating.reviewer_display_name}</strong>
            <Stars score={rating.score} />
          </div>
          {rating.comment && <p>{rating.comment}</p>}
          <p className="muted">{new Date(rating.created_at).toLocaleDateString()}</p>
        </li>
      ))}
    </ul>
  )
}
