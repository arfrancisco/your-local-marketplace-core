import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth'
import { useBecomeVendor } from '../useBecomeVendor'
import { vendorWebUrl } from '../vendorWeb'
import { FeedbackModal } from './FeedbackModal'

// Replaces the header's inline link row at *every* width, not just on mobile —
// the top bar is now just the brand plus this button and the cart icon.
// Right-anchored slide-in drawer built on the same .modal-backdrop/.modal
// convention as FeedbackModal/ItemDetailModal/LegalModal; .drawer is the only
// difference, pinning the panel to the right edge instead of centering it.
export function HamburgerMenu() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const { start: startBecomingVendor, starting: startingVendor } = useBecomeVendor()

  function close() {
    setOpen(false)
  }

  return (
    <>
      <button
        className="icon-btn menu-icon-btn"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>☰</span>
      </button>

      {open && (
        <div className="modal-backdrop" onClick={close}>
          <nav
            className="modal drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
            onClick={(e) => e.stopPropagation()}
          >
            <button className="modal-close" aria-label="Close menu" onClick={close}>×</button>

            {user && (
              <p className="muted drawer-identity">
                {user.customer_profile?.display_name ?? user.email}
              </p>
            )}

            <ul className="list drawer-nav">
              <li><Link to="/shops" onClick={close}>Home</Link></li>
              {user && (
                <>
                  <li><Link to="/orders" onClick={close}>My orders</Link></li>
                  <li><Link to="/account" onClick={close}>My account</Link></li>
                  {/* Gated on actual eligibility (not just "no vendor_profile
                      yet") — offering this to someone who isn't eligible
                      (e.g. not a resident) just bounces them to /account via
                      useBecomeVendor's catch, which reads as a broken link. */}
                  {!user.vendor_profile && user.vendor_eligibility.eligible && (
                    <li className="drawer-cta">
                      <button
                        type="button"
                        className="link-button"
                        disabled={startingVendor}
                        onClick={() => {
                          close()
                          startBecomingVendor()
                        }}
                      >
                        {startingVendor ? 'One moment…' : 'Become a vendor'}
                      </button>
                    </li>
                  )}
                  {user.vendor_profile && (
                    <li>
                      {/* Real page navigation, not React Router's Link — this
                          crosses into the separate vendor-web SPA, and this
                          app's own catch-all route would otherwise swallow
                          client-side nav to a path that doesn't exist here. */}
                      <a href={vendorWebUrl('/shops')}>Vendor dashboard</a>
                    </li>
                  )}
                </>
              )}
              <li>
                <button
                  className="inline-link"
                  onClick={() => {
                    close()
                    setFeedbackOpen(true)
                  }}
                >
                  Send feedback
                </button>
              </li>
              {user ? (
                <li>
                  <button
                    className="inline-link"
                    onClick={() => {
                      close()
                      logout()
                    }}
                  >
                    Sign out
                  </button>
                </li>
              ) : (
                <>
                  <li><Link to="/login" onClick={close}>Sign in</Link></li>
                  <li><Link to="/login?mode=register" onClick={close}>Create account</Link></li>
                </>
              )}
            </ul>
          </nav>
        </div>
      )}

      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </>
  )
}
