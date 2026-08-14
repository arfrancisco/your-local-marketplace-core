import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { customerWebUrl } from '../customerWeb'

interface Props {
  email: string
  onClose: () => void
  onFeedback: () => void
  onSignOut: () => void
}

// Slide-in nav drawer behind the bottom bar's ☰ button. Hand-rolled on the same
// `.modal-backdrop`/`.modal` markup FeedbackModal uses, just anchored to the
// right edge instead of centered (see the drawer rules in index.css) — no
// drawer/popover dependency, matching this app's zero-UI-dependency style.
// Per ADR 0001 there is no shared package between the two web clients, so
// customer-web has its own near-duplicate of this, same as OrderChat.
export function HamburgerMenu({ email, onClose, onFeedback, onSignOut }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop drawer-backdrop" onClick={onClose}>
      <nav
        className="modal drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close menu" onClick={onClose}>×</button>
        <p className="drawer-email muted">{email}</p>
        <ul className="drawer-links">
          <li>
            {/* Real page navigation, not React Router's Link — this crosses
                into the separate customer-web SPA, the same pattern
                customer-web's own HamburgerMenu uses for its "Vendor
                dashboard" link the other direction. */}
            <a href={customerWebUrl('/shops')}>Back to marketplace</a>
          </li>
          <li>
            <Link to="/shops" onClick={onClose}>Home</Link>
          </li>
          <li>
            <Link to="/account" onClick={onClose}>Account</Link>
          </li>
          <li>
            <button type="button" onClick={onFeedback}>Send feedback</button>
          </li>
          <li>
            <button type="button" onClick={onSignOut}>Sign out</button>
          </li>
        </ul>
      </nav>
    </div>
  )
}
