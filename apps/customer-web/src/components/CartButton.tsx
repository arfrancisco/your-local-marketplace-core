import { useEffect, useRef, useState } from 'react'
import { useCart } from '../CartContext'

const BUMP_MS = 300

// Persistent cart icon. Floats bottom-right (App.tsx's .bottom-fabs wrapper,
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
      <span aria-hidden>🛒</span>
      {count > 0 && <span className="cart-badge">{count}</span>}
    </button>
  )
}
