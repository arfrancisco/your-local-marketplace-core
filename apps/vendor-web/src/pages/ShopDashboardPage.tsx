import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Shop } from '../api/types'
import { TourCallout } from '../components/TourCallout'
import { RatingSummary } from '../components/Ratings'
import { DashboardActionsMenu } from '../components/DashboardActionsMenu'
import { OrderList } from '../components/OrderList'
import { colorFor, emojiFor } from '../visuals'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

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

// Dashboard tour stops, in order: shop open/close control, the shop actions
// menu (edit/inventory/reviews), the order list, then a closing "you're all
// set" message.
const TOUR_STOPS = 4

// A vendor owns exactly one shop (enforced on the API by a uniqueness
// constraint on shops.vendor_profile_id), so there is nothing to list — this
// is that one shop's dashboard, not an index. Route stays at /shops. Order
// management is the main thing a vendor needs day to day, so it's the
// dashboard's primary content; the less-frequent actions (edit shop
// details, inventory, reviews) live behind the kebab menu instead of as
// primary buttons.
export function ShopDashboardPage({ onboardingMode = false, onTourDone }: ShopDashboardPageProps = {}) {
  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<'open' | 'close' | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
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
    setStatusError(null)
    try {
      const res = open ? await api.openShop(target.id) : await api.closeShop(target.id)
      setShop(res.shop)
      setPendingStatusChange(null)
    } catch (err) {
      // A restricted vendor (Orders::CancellationAbuseCheck) can't reopen
      // until an admin clears it — surface why instead of failing silently.
      setStatusError(err instanceof ApiError ? err.message : 'Could not update your shop status')
    } finally {
      setBusy(false)
    }
  }

  // The toggle now sits at the very top of the page, right where a stray tap
  // is most likely (e.g. reaching for something else while the page is still
  // loading) — both directions go through a confirmation, not just closing.
  function onStatusClick() {
    if (!shop) return
    setStatusError(null)
    setPendingStatusChange(shop.open ? 'close' : 'open')
  }

  if (loading) return <p>Loading your shop…</p>
  if (!shop) return <p>No shop yet. Create your first one.</p>

  const fallbackKey = `${shop.name} ${shop.description ?? ''}`

  return (
    <div>
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

      <div className="tour-anchor">
        {showTour && (
          <div className="dashboard-topbar">
            <button type="button" className="tour-skip" onClick={skipTour}>
              Skip tour
            </button>
          </div>
        )}

        <div className="shop-hero">
          {shop.cover_photo ? (
            <img className="shop-cover" src={`${API_ORIGIN}${shop.cover_photo.url}`} alt="" />
          ) : (
            <div className="shop-cover tile" style={{ background: colorFor(shop.name) }} aria-hidden>
              {emojiFor(fallbackKey)}
            </div>
          )}
          <div className="shop-identity">
            {shop.profile_photo ? (
              <img className="shop-avatar" src={`${API_ORIGIN}${shop.profile_photo.url}`} alt="" />
            ) : (
              <div className="shop-avatar tile" style={{ background: colorFor(shop.name) }} aria-hidden>
                {emojiFor(fallbackKey)}
              </div>
            )}
            <div className="shop-identity-text">
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
            <div className="shop-identity-actions tour-anchor">
              <DashboardActionsMenu shopId={shop.id} />
              {showTour && tourStep === 1 && (
                <TourCallout
                  message="Edit your shop details, manage inventory, and see reviews from this menu."
                  onNext={advanceTour}
                  onSkip={skipTour}
                />
              )}
            </div>
          </div>
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
        <h2 className="section">Orders</h2>
        <OrderList shopId={shop.id} />
        {showTour && tourStep === 2 && (
          <TourCallout
            message="Incoming orders land here. You move each one forward yourself — accepted, preparing, ready — nothing changes automatically."
            onNext={advanceTour}
            onSkip={skipTour}
          />
        )}
      </div>

      {pendingStatusChange && (
        <div className="modal-backdrop" onClick={() => { setPendingStatusChange(null); setStatusError(null) }}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={pendingStatusChange === 'close' ? 'Close your shop?' : 'Open your shop?'}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>{pendingStatusChange === 'close' ? 'Close your shop?' : 'Open your shop?'}</h2>
            <p className="muted">
              {pendingStatusChange === 'close'
                ? "Customers won't be able to find or order from you until you reopen. Existing orders stay accessible."
                : 'Customers will be able to find your shop and place orders right away.'}
            </p>
            {statusError && <p role="alert" className="error">{statusError}</p>}
            <div className="row gap modal-actions">
              <button type="button" className="button" onClick={() => { setPendingStatusChange(null); setStatusError(null) }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setOpen(shop, pendingStatusChange === 'open')}
                disabled={busy}
              >
                {pendingStatusChange === 'close' ? 'Close shop' : 'Open shop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
