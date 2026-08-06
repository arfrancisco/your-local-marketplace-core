import { useEffect, useRef, useState } from 'react'
import { useCart } from '../CartContext'

const BUMP_MS = 300

// Plain stroked SVG, not the 🛒 emoji this replaces — matches this app's
// zero-icon-library convention (see e.g. ShopsPage.tsx's SearchIcon) and
// renders as a flat, consistent white glyph instead of a platform-specific,
// multi-color emoji drawing.
function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M3 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.4a2 2 0 0 0 2-1.6L22 6H6"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="21" r="1.5" fill="#fff" />
      <circle cx="18" cy="21" r="1.5" fill="#fff" />
    </svg>
  )
}

// Persistent cart icon. Lives in the fixed bottom bar (App.tsx's BottomBar,
// alongside the active-order button) rather than sitting in the top header
// cluster with the hamburger, so it stays reachable without crowding the
// brand/tagline on narrow screens — on every page, not just the shop page.
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
      className={`icon-btn cart-icon-btn ${bumping ? 'bump' : ''}`}
      onClick={openCart}
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}
    >
      <CartIcon />
      {count > 0 && <span className="cart-badge">{count}</span>}
    </button>
  )
}
