import type { Rating } from '../api/types'

// Presentational bits shared by the shop list, shop page and order page.
// Deliberately plain text stars — no icon set, matching the rest of this app.

export function Stars({ score }: { score: number }) {
  const filled = Math.round(score)
  return (
    <span className="stars" aria-label={`${score} out of 5`}>
      {'★'.repeat(filled)}
      {'☆'.repeat(Math.max(0, 5 - filled))}
    </span>
  )
}

// Never renders "★ 0" for an unrated shop — an absent score and a bad score
// are different things, and the API sends null rather than 0 for the former.
export function RatingSummary({
  averageRating,
  ratingsCount,
  emptyLabel,
}: {
  averageRating: number | null
  ratingsCount: number
  emptyLabel?: string
}) {
  if (ratingsCount === 0 || averageRating === null) {
    return emptyLabel ? <span className="muted small">{emptyLabel}</span> : null
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
          <p className="muted small">{new Date(rating.created_at).toLocaleDateString()}</p>
        </li>
      ))}
    </ul>
  )
}
