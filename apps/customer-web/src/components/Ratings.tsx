import { useState } from 'react'
import { api, ApiError } from '../api/client'
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

// The star-picker/textarea/submit form itself, extracted out of OrderPage's
// RateOrderCard so it can be reused by RatingNudgeModal (the global pop-up
// nudge) as well as the order page's own inline card. Purely the form —
// callers decide when/whether to show it (gating on order.status/rating is
// still the caller's job, same as before this was split out).
export function RatingForm({ orderId, onRated }: { orderId: number; onRated: (rating: Rating) => void }) {
  const [score, setScore] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit() {
    if (score < 1) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await api.rateOrder(orderId, score, comment.trim() || undefined)
      onRated(res.rating)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your rating')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="row gap star-picker">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className="star-btn"
            aria-label={`${value} star${value === 1 ? '' : 's'}`}
            aria-pressed={score === value}
            onClick={() => setScore(value)}
          >
            {value <= score ? '★' : '☆'}
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything you'd like to say about this order? (optional)"
        aria-label="Review comment"
        rows={3}
      />
      {error && <p role="alert" className="error">{error}</p>}
      <button onClick={onSubmit} disabled={submitting || score < 1}>
        {submitting ? 'Submitting…' : 'Submit rating'}
      </button>
    </>
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
