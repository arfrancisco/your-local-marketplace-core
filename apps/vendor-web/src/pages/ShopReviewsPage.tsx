import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Rating, Shop } from '../api/types'
import { RatingList, RatingSummary } from '../components/Ratings'

const REVIEWS_PER_PAGE = 5

// Read-only: vendors see their standing and what was said, but can't reply
// to or remove a review. Its own page (linked from the bottom TabBar)
// rather than embedded in the edit-shop form, which is about the shop's
// own settings, not what customers have said about it.
export function ShopReviewsPage() {
  const { id } = useParams()
  const [shop, setShop] = useState<Shop | null>(null)
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [page, setPage] = useState(0)

  useEffect(() => {
    if (!id) return
    api
      .getShop(Number(id))
      .then((res) => setShop(res.shop))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!shop?.slug) return
    setReviewsLoading(true)
    api
      .listShopRatings(shop.slug, { limit: REVIEWS_PER_PAGE, offset: page * REVIEWS_PER_PAGE })
      .then((res) => setRatings(res.ratings))
      .catch(() => setRatings([]))
      .finally(() => setReviewsLoading(false))
  }, [shop?.slug, page])

  if (loading) return <p>Loading…</p>
  if (!shop) return <p>This shop is not available.</p>

  const totalPages = Math.max(1, Math.ceil(shop.ratings_count / REVIEWS_PER_PAGE))

  return (
    <div>
      <div className="row spread reviews-header">
        <h1>Reviews</h1>
        <RatingSummary
          averageRating={shop.average_rating}
          ratingsCount={shop.ratings_count}
          emptyLabel="No reviews yet."
        />
      </div>

      {shop.ratings_count === 0 ? (
        <p className="muted">No reviews yet.</p>
      ) : reviewsLoading ? (
        <p className="muted">Loading reviews…</p>
      ) : (
        <RatingList ratings={ratings} />
      )}

      {/* Most-recent-first (the API's own default order) — paging further
          back is "older", not "more". */}
      {totalPages > 1 && (
        <div className="row spread reviews-pagination">
          <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
            ← Newer
          </button>
          <span className="muted small">
            Page {page + 1} of {totalPages}
          </span>
          <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages - 1}>
            Older →
          </button>
        </div>
      )}
    </div>
  )
}
