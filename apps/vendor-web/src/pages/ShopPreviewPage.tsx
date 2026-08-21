import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Item, Rating, Shop } from '../api/types'
import { RatingList, RatingSummary } from '../components/Ratings'
import { ShopPreview } from '../components/ShopPreview'
import { TourCallout } from '../components/TourCallout'
import { HelpTourButton } from '../components/HelpTourButton'

const REVIEWS_PER_PAGE = 5

// Read-only mirror of customer-web's ShopDetailPage — same cover-photo hero,
// identity card, and item list markup, so a vendor sees the actual page a
// customer would land on before they ever open their shop. No cart/checkout/
// add-to-cart here on purpose: this is a look, not a transaction. A duplicate
// implementation rather than a shared import (ADR 0001 — no shared package
// between apps).
//
// The shop rendering itself lives in ShopPreview, which the onboarding
// wizard's live preview accordion also uses. This page owns the page-level
// framing: back link, banners, and the reviews section with its own paging.
export function ShopPreviewPage() {
  const { id } = useParams()
  const location = useLocation()
  // Where "Preview shop" was clicked from — the dashboard's kebab menu and
  // the edit form's own "Preview shop" link both lead here, and the useful
  // back target is different for each. Defaults to the edit form (also
  // covers a direct URL visit/refresh, where there's no real "from" at all).
  const from = (location.state as { from?: 'dashboard' | 'edit' } | null)?.from ?? 'edit'
  const [tourOpen, setTourOpen] = useState(false)
  const [shop, setShop] = useState<Shop | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [ratings, setRatings] = useState<Rating[]>([])
  const [loading, setLoading] = useState(true)
  // Collapsed by default, paginated once opened — matches customer-web's own
  // ShopDetailPage exactly, since the whole point of this page is to be
  // what a customer actually sees.
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [reviewsPage, setReviewsPage] = useState(0)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([api.getShop(Number(id)), api.listItems(Number(id))])
      .then(([shopRes, itemsRes]) => {
        setShop(shopRes.shop)
        // Disabled items never reach a customer at all — only sold-out items
        // (still listed, just greyed out) do. Filtering here, not on the
        // server, since this same list endpoint is also the vendor's own
        // inventory-management view (ItemsPage), where disabled items must
        // stay visible so they can be re-enabled.
        setItems(itemsRes.items.filter((item) => item.enabled))
      })
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (!shop?.slug || !reviewsOpen) return
    setReviewsLoading(true)
    api
      .listShopRatings(shop.slug, { limit: REVIEWS_PER_PAGE, offset: reviewsPage * REVIEWS_PER_PAGE })
      .then((res) => setRatings(res.ratings))
      .catch(() => setRatings([]))
      .finally(() => setReviewsLoading(false))
  }, [shop?.slug, reviewsOpen, reviewsPage])

  if (loading) return <p>Loading preview…</p>
  if (!shop) return <p>This shop is not available.</p>

  const totalReviewPages = Math.max(1, Math.ceil(shop.ratings_count / REVIEWS_PER_PAGE))

  return (
    <div>
      <HelpTourButton onClick={() => setTourOpen(true)} label="Tour this preview" />
      <p className="back-link">
        {from === 'dashboard' ? (
          <Link className="button" to="/shops">← Back to dashboard</Link>
        ) : (
          <Link className="button" to={`/shops/${id}/edit`}>← Back to editing</Link>
        )}
      </p>
      <div className="preview-banner">
        This is a preview of your shop's page — it's exactly what a customer
        sees, minus the ability to order.
      </div>

      {shop.demo && (
        <p className="demo-shop-banner" role="alert">
          This is a demo shop for previewing the app. Orders placed here are
          not real and will not be prepared or delivered.
        </p>
      )}

      <ShopPreview
        shop={shop}
        items={items}
        showBackAffordance
        heroAddon={
          tourOpen && (
            <TourCallout
              message="This is exactly what a customer sees when they find your shop."
              onNext={() => setTourOpen(false)}
              onSkip={() => setTourOpen(false)}
            />
          )
        }
      />

      <div className="row spread reviews-header">
        <h2 className="section">Reviews</h2>
        <RatingSummary
          averageRating={shop.average_rating}
          ratingsCount={shop.ratings_count}
          emptyLabel="No reviews yet."
        />
      </div>

      {shop.ratings_count > 0 && (
        <button
          type="button"
          className="reviews-toggle"
          onClick={() => setReviewsOpen((open) => !open)}
          aria-expanded={reviewsOpen}
        >
          {reviewsOpen ? 'Hide reviews' : `Show reviews (${shop.ratings_count})`}
        </button>
      )}

      {reviewsOpen && (
        <>
          {reviewsLoading ? <p className="muted">Loading reviews…</p> : <RatingList ratings={ratings} />}

          {totalReviewPages > 1 && (
            <div className="row spread reviews-pagination">
              <button type="button" onClick={() => setReviewsPage((p) => p - 1)} disabled={reviewsPage === 0}>
                ← Newer
              </button>
              <span className="muted small">
                Page {reviewsPage + 1} of {totalReviewPages}
              </span>
              <button
                type="button"
                onClick={() => setReviewsPage((p) => p + 1)}
                disabled={reviewsPage >= totalReviewPages - 1}
              >
                Older →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
