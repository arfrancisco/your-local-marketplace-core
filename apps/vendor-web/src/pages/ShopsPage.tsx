import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { Shop } from '../api/types'
import { TourCallout } from '../components/TourCallout'

interface ShopsPageProps {
  /** Onboarding step 3 (OnboardingPage) renders this same component with
   * onboardingMode on, right after the vendor's first shop is created, and
   * layers a short sequence of callouts pointing at the first shop card's
   * controls. Outside onboarding this prop is absent and the page behaves
   * exactly as before. */
  onboardingMode?: boolean
  /** Called once the dashboard tour finishes (last callout dismissed) or is
   * skipped, so the caller can land the vendor on the real /shops route. */
  onTourDone?: () => void
}

// Dashboard tour stops, in order: shop open/close toggle, Items link,
// Orders link, then a closing "you're all set" message.
const TOUR_STOPS = 4

export function ShopsPage({ onboardingMode = false, onTourDone }: ShopsPageProps = {}) {
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [tourStep, setTourStep] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    api
      .listShops()
      .then((res) => {
        setShops(res.shops)
        // A vendor with zero shops has nothing to see here — send them
        // through onboarding instead of a bare "no shops yet" list. Derived
        // from data (no shops), not a stored flag. Skip this when we're
        // already the onboarding-mode render (step 3, right after the first
        // shop was just created) to avoid any redirect loop.
        if (res.shops.length === 0 && !onboardingMode) {
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

  const showTour = onboardingMode && shops.length > 0 && tourStep < TOUR_STOPS

  async function toggleOpen(shop: Shop) {
    setBusyId(shop.id)
    try {
      const res = shop.open ? await api.closeShop(shop.id) : await api.openShop(shop.id)
      setShops((prev) => prev.map((s) => (s.id === shop.id ? res.shop : s)))
    } finally {
      setBusyId(null)
    }
  }

  if (loading) return <p>Loading shops…</p>

  return (
    <div>
      <div className="tour-anchor">
        <div className="row spread">
          <h1>Your shops</h1>
          <div className="row gap">
            {showTour && (
              <button type="button" className="tour-skip" onClick={skipTour}>
                Skip tour
              </button>
            )}
            <Link className="button" to="/shops/new">New shop</Link>
          </div>
        </div>
        {showTour && tourStep === 3 && (
          <TourCallout
            message="You're all set! This is your dashboard from here on — come back anytime to manage shops, items, and orders."
            nextLabel="Done"
            onNext={advanceTour}
            onSkip={skipTour}
          />
        )}
      </div>

      {shops.length === 0 && <p>No shops yet. Create your first one.</p>}

      <ul className="list">
        {shops.map((shop, idx) => {
          const tourHere = showTour && idx === 0
          return (
            <li key={shop.id} className="card">
              <div className="row spread">
                <div>
                  <h2>{shop.name}</h2>
                  <p className="muted">
                    {shop.open ? 'Open' : shop.status === 'active' ? 'Closed' : 'Draft'} ·{' '}
                    {shop.fulfillment_methods.join(', ') || 'no fulfillment'}
                  </p>
                </div>
                <div className="row gap">
                  <div className="tour-anchor">
                    <button onClick={() => toggleOpen(shop)} disabled={busyId === shop.id}>
                      {shop.open ? 'Close' : 'Open'}
                    </button>
                    {tourHere && tourStep === 0 && (
                      <TourCallout
                        message="Toggle your shop open or closed anytime — customers only see it in their shop list while it's open."
                        onNext={advanceTour}
                        onSkip={skipTour}
                      />
                    )}
                  </div>
                  <Link className="button" to={`/shops/${shop.id}/edit`}>Edit</Link>
                  <div className="tour-anchor">
                    <Link className="button" to={`/shops/${shop.id}/items`}>Inventory</Link>
                    {tourHere && tourStep === 1 && (
                      <TourCallout
                        message="Add items here — photos, price, and stock for what you're selling."
                        onNext={advanceTour}
                        onSkip={skipTour}
                      />
                    )}
                  </div>
                  <div className="tour-anchor">
                    <Link className="button" to={`/orders?shop_id=${shop.id}`}>Orders</Link>
                    {tourHere && tourStep === 2 && (
                      <TourCallout
                        message="Incoming orders land here. You move each one forward yourself — accepted, preparing, ready — nothing changes automatically."
                        onNext={advanceTour}
                        onSkip={skipTour}
                      />
                    )}
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
