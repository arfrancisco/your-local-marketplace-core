import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Shop } from '../api/types'
import { TourCallout } from '../components/TourCallout'
import { RatingSummary } from '../components/Ratings'

interface ShopDashboardPageProps {
  /** Onboarding step 3 (OnboardingPage) renders this same component with
   * onboardingMode on, right after the vendor's first shop is created, and
   * layers a short sequence of callouts pointing at the dashboard's
   * controls. Outside onboarding this prop is absent and the page behaves
   * exactly as before. */
  onboardingMode?: boolean
  /** Called once the dashboard tour finishes (last callout dismissed) or is
   * skipped, so the caller can land the vendor on the real /shops route. */
  onTourDone?: () => void
}

// Dashboard tour stops, in order: shop open/close control, Inventory link,
// Orders link, then a closing "you're all set" message.
const TOUR_STOPS = 4

// A vendor owns exactly one shop (enforced on the API by a uniqueness
// constraint on shops.vendor_profile_id), so there is nothing to list — this
// is that one shop's dashboard, not an index. Route stays at /shops.
export function ShopDashboardPage({ onboardingMode = false, onTourDone }: ShopDashboardPageProps = {}) {
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .listShops()
      .then((res) => {
        setShop(res.shops[0] ?? null)
        // A vendor with no shop has nothing to see here — send them through
        // onboarding instead of a bare empty dashboard. Derived from data (no
        // shop), not a stored flag. Skip this when we're already the
        // onboarding-mode render (step 3, right after the first shop was just
        // created) to avoid any redirect loop.
        if (!res.shops[0] && !onboardingMode) {
          navigate('/onboarding', { replace: true })
        }
      })
      .finally(() => setLoading(false))
  }, [onboardingMode, navigate])

  function advanceTour() {
    setTourStep((s) => {
      const next = s + 1
      if (next >= TOUR_STOPS) onTourDone?.()
      return next
    })
  }

  function skipTour() {
    setTourStep(TOUR_STOPS)
    onTourDone?.()
  }

  const showTour = onboardingMode && !!shop && tourStep < TOUR_STOPS

  async function setOpen(target: Shop, open: boolean) {
    setBusy(true)
    try {
      const res = open ? await api.openShop(target.id) : await api.closeShop(target.id)
      setShop(res.shop)
    } finally {
      setBusy(false)
      setConfirmingClose(false)
    }
  }

  // Closing hides the shop from every customer, so it gets a confirmation.
  // Opening has no downside and is trivially reversible, so it does not.
  function onStatusClick() {
    if (!shop) return
    if (shop.open) setConfirmingClose(true)
    else void setOpen(shop, true)
  }

  if (loading) return <p>Loading your shop…</p>
  if (!shop) return <p>No shop yet. Create your first one.</p>

  return (
    <div>
      <div className="tour-anchor">
        <div className="row spread">
          <div>
            <h1>{shop.name}</h1>
            <p className="muted">
              {shop.fulfillment_methods.join(', ') || 'no fulfillment'}
              {shop.status !== 'active' && ' · not published yet'}
            </p>
            <p className="muted">
              <RatingSummary
                averageRating={shop.average_rating}
                ratingsCount={shop.ratings_count}
                emptyLabel="No reviews yet"
              />
            </p>
          </div>
          {showTour && (
            <button type="button" className="tour-skip" onClick={skipTour}>
              Skip tour
            </button>
          )}
        </div>
        {showTour && tourStep === 3 && (
          <TourCallout
            message="You're all set! This is your dashboard from here on — come back anytime to manage your shop, items, and orders."
            nextLabel="Done"
            onNext={advanceTour}
            onSkip={skipTour}
          />
        )}
      </div>

      <div className="tour-anchor">
        <button
          type="button"
          className={`shop-status-bar ${shop.open ? 'is-open' : 'is-closed'}`}
          onClick={onStatusClick}
          disabled={busy}
        >
          <span className="shop-status-state">
            <span className="shop-status-dot" aria-hidden="true" />
            Shop is {shop.open ? 'OPEN' : 'CLOSED'}
          </span>
          <span className="shop-status-action">
            {shop.open ? 'Tap to close' : 'Tap to open'}
          </span>
        </button>
        <p className="muted shop-status-hint">
          {shop.open
            ? 'Customers can find your shop and place orders right now.'
            : 'Customers cannot find your shop while it is closed.'}
        </p>
        {showTour && tourStep === 0 && (
          <TourCallout
            message="Toggle your shop open or closed anytime — customers only see it in their shop list while it's open."
            onNext={advanceTour}
            onSkip={skipTour}
          />
        )}
      </div>

      <div className="card shop-actions">
        <Link className="button" to={`/shops/${shop.id}/edit`}>Edit shop details</Link>
        <div className="tour-anchor">
          <Link className="button" to={`/shops/${shop.id}/items`}>Inventory</Link>
          {showTour && tourStep === 1 && (
            <TourCallout
              message="Add items here — photos, price, and stock for what you're selling."
              onNext={advanceTour}
              onSkip={skipTour}
            />
          )}
        </div>
        <div className="tour-anchor">
          <Link className="button" to={`/orders?shop_id=${shop.id}`}>Orders</Link>
          {showTour && tourStep === 2 && (
            <TourCallout
              message="Incoming orders land here. You move each one forward yourself — accepted, preparing, ready — nothing changes automatically."
              onNext={advanceTour}
              onSkip={skipTour}
            />
          )}
        </div>
      </div>

      {confirmingClose && (
        <div className="modal-backdrop" onClick={() => setConfirmingClose(false)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Close your shop?"
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Close your shop?</h2>
            <p className="muted">
              Customers won't be able to find or order from you until you reopen. Existing orders
              stay accessible.
            </p>
            <div className="row gap modal-actions">
              <button type="button" className="button" onClick={() => setConfirmingClose(false)}>
                Cancel
              </button>
              <button type="button" onClick={() => setOpen(shop, false)} disabled={busy}>
                Close shop
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
