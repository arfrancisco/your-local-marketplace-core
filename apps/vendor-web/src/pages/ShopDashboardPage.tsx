import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Shop } from '../api/types'
import { TourCallout } from '../components/TourCallout'
import { HelpTourButton } from '../components/HelpTourButton'
import { RatingSummary } from '../components/Ratings'
import { OrderList } from '../components/OrderList'
import { SetupProgress } from '../components/SetupProgress'
import { useMyShopState } from '../useMyShop'
import { colorFor, emojiFor } from '../visuals'
import {
  ONBOARDING_STEPS,
  ONBOARDING_STEP_LABELS,
  stepNumber,
  stepPath,
  toOnboardingStep,
} from '../onboarding'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

// Dashboard tour stops, in order: a centered "welcome to your dashboard"
// message, the shop open/close control, the order list, then the shop
// actions menu (edit/inventory/reviews) last. An optional, on-demand tour
// behind the "?" button (HelpTourButton), not shown automatically.
const TOUR_STOPS = 4

// A vendor owns exactly one shop (enforced on the API by a uniqueness
// constraint on shops.vendor_profile_id), so there is nothing to list — this
// is that one shop's dashboard, not an index. Route stays at /shops. Order
// management is the main thing a vendor needs day to day, so it's the
// dashboard's primary content; the less-frequent actions (edit shop
// details, inventory, reviews) live behind the kebab menu instead of as
// primary buttons.
export function ShopDashboardPage() {
  const { shop, loading, setShop } = useMyShopState()
  const [busy, setBusy] = useState(false)
  const [pendingStatusChange, setPendingStatusChange] = useState<'open' | 'close' | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const navigate = useNavigate()

  useEffect(() => {
    // A vendor with no shop has nothing to see here — send them through
    // onboarding instead of a bare empty dashboard. Derived from data (no
    // shop), not a stored flag.
    if (!loading && !shop) navigate('/onboarding', { replace: true })
  }, [loading, shop, navigate])

  function openTour() {
    setTourOpen(true)
    setTourStep(0)
  }

  function advanceTour() {
    setTourStep((s) => {
      const next = s + 1
      if (next >= TOUR_STOPS) setTourOpen(false)
      return next
    })
  }

  function skipTour() {
    setTourOpen(false)
    setTourStep(0)
  }

  const showTour = tourOpen && !!shop && tourStep < TOUR_STOPS

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

  // Sits below the shop banner/identity now, above Orders — both directions
  // still go through a confirmation, not just closing, regardless of where
  // the toggle lives on the page.
  function onStatusClick() {
    if (!shop) return
    setStatusError(null)
    setPendingStatusChange(shop.open ? 'close' : 'open')
  }

  if (loading) return <p>Loading your shop…</p>
  if (!shop) return <p>No shop yet. Create your first one.</p>

  const fallbackKey = `${shop.name} ${shop.description ?? ''}`
  // Strictly null, not just falsy: a payload without the field at all (an
  // older API, or a shop serialized without the vendor-only fields) says
  // nothing about setup, and shouldn't nag.
  const setupUnfinished = shop.onboarding_completed_at === null
  const resumeStep = toOnboardingStep(shop.onboarding_step)
  // Finishing the wizard is not the same as being able to open. A shop can
  // be onboarding-complete and still blocked: every pre-wizard shop was
  // backfilled as complete (including abandoned signups with no items), and
  // a live vendor can empty their catalogue at any time. Without this the
  // resume banner is the only nudge, and it is already gone by then — so the
  // vendor closes for a night, cannot reopen, and is told why only by an
  // error inside a modal they have to go looking for.
  const openBlockers = shop.open_blockers ?? []
  const showReadiness = !setupUnfinished && openBlockers.length > 0

  return (
    <div>
      <HelpTourButton onClick={openTour} label="Tour your dashboard" />

      {setupUnfinished && (
        <div className="card onboarding-resume">
          <h2>Finish setting up your shop</h2>
          <p className="muted">
            You're on step {stepNumber(resumeStep)} of {ONBOARDING_STEPS.length} —{' '}
            {ONBOARDING_STEP_LABELS[resumeStep]}.{' '}
            {/* The open/closed toggle below is deliberately independent of
                setup, so an open shop really is visible to customers even
                with steps left — saying otherwise here would be a lie. */}
            {shop.open
              ? 'Your shop is already open, so neighbors can find it while you finish.'
              : 'Nobody can see your shop until you finish.'}
          </p>
          <SetupProgress step={stepNumber(resumeStep)} total={ONBOARDING_STEPS.length} showLabel={false} />
          <Link className="button" to={stepPath(resumeStep)}>Continue setup</Link>
        </div>
      )}

      {showReadiness && (
        <div className="card shop-readiness">
          <h2>{shop.open ? 'Your shop needs attention' : "Your shop can't open yet"}</h2>
          <p className="muted">
            {shop.open
              ? 'Neighbors can find your shop right now, but it will not be able to reopen once you close it until these are sorted:'
              : 'Before you can open, please sort these out:'}
          </p>
          <ul className="list readiness-list">
            {openBlockers.map((blocker) => (
              <li key={blocker.code}>
                {blocker.message}{' '}
                {/* A reason with no way to act on it just reads as a dead
                    end, so each one carries the link that fixes it. */}
                {blocker.code === 'no_enabled_items' ? (
                  <Link to={`/shops/${shop.id}/items`}>Go to Inventory</Link>
                ) : (
                  <Link to={`/shops/${shop.id}/edit`}>Edit your shop</Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {showTour && tourStep === 0 && (
        <TourCallout
          message="This is your dashboard from here on — come back anytime to manage your shop, items, and orders."
          centered
          onNext={advanceTour}
          onSkip={skipTour}
        />
      )}
      <div className="tour-anchor">
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
              {/* Kebab menu retired — Inventory and Reviews moved to the
                  bottom TabBar, leaving just these two, so a menu was more
                  ceremony than the destinations warranted. Plain colored
                  text links instead, same spot. */}
              <div className="shop-quick-links">
                <Link to={`/shops/${shop.id}/edit`} className="shop-quick-link is-edit">
                  Edit
                </Link>
                <Link
                  to={`/shops/${shop.id}/preview`}
                  state={{ from: 'dashboard' }}
                  className="shop-quick-link is-preview"
                >
                  Shop Preview
                </Link>
              </div>
              {showTour && tourStep === 3 && (
                <TourCallout
                  message="Edit your shop details or preview it here — inventory and reviews live in the bottom tabs."
                  onNext={advanceTour}
                  onSkip={skipTour}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="tour-anchor shop-status-block">
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
        {showTour && tourStep === 1 && (
          <TourCallout
            message="Toggle your shop open or closed anytime — customers only see it in their shop list while it's open."
            onNext={advanceTour}
            onSkip={skipTour}
          />
        )}
      </div>

      <div className="tour-anchor">
        <h2 className="section">Orders</h2>
        <OrderList />
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
