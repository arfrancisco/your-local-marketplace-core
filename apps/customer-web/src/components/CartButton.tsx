import { useEffect, useRef, useState } from 'react'
import { useCart } from '../CartContext'

const BUMP_MS = 300

// Plain stroked SVG, not an emoji or the old wheeled-cart glyph — matches
// this app's zero-icon-library convention (see e.g. ShopsPage.tsx's
// SearchIcon). A shopping-bag outline (handle + rectangular body) instead of
// the previous wheeled-cart path, to fit the tab bar's icon+label convention
// alongside Home/Orders/Vendor/Account. stroke="currentColor" (not a
// hardcoded white) so it tints via CSS the same way the other tab icons do.
function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 8h12l1 12a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L6 8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 8V6a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Cart tab. Lives in the persistent tab bar (TabBar.tsx) alongside
// Home/Orders/Vendor/Account — same trigger mechanism as before
// (useCart().openCart()) and the same bump-on-add animation and count badge,
// just relocated into the tab bar's icon-above-label slot instead of a
// standalone floating circular button. Cart has no dedicated route, so
// unlike the other tabs it's never "active" (no NavLink here).
export function CartButton() {
  const { count, openCart } = useCart()
  const [bumping, setBumping] = useState(false)
  const previousCount = useRef(count)

  // Bump only on an *increase* — removing a line shouldn't celebrate. The class
  // is dropped again after the animation's own duration so it can re-trigger on
  // the next add.
  useEffect(() => {
    const grew = count > previousCount.current
    previousCount.current = count
    if (!grew) return
    setBumping(true)
    const timer = setTimeout(() => setBumping(false), BUMP_MS)
    return () => clearTimeout(timer)
  }, [count])

  return (
    <button
      className={`tab-bar-item cart-icon-btn ${bumping ? 'bump' : ''}`}
      onClick={openCart}
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}
    >
      <span className="tab-bar-icon-wrap">
        <CartIcon />
        {count > 0 && <span className="cart-badge">{count}</span>}
      </span>
      <span className="tab-bar-label">Cart</span>
    </button>
  )
}
