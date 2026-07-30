import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Cart, Item, Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'
import { useAuth } from '../auth'
import { AuthModal } from '../components/AuthModal'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

export function ShopDetailPage() {
  const { slug } = useParams()
  const { user } = useAuth()

  const [shop, setShop] = useState<Shop | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [cart, setCart] = useState<Cart | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [authOpen, setAuthOpen] = useState(false)
  const [pendingItemId, setPendingItemId] = useState<number | null>(null)
  const [checkoutDone, setCheckoutDone] = useState(false)

  useEffect(() => {
    if (!slug) return
    Promise.all([api.getShop(slug), api.listItems(slug)])
      .then(([shopRes, itemsRes]) => {
        setShop(shopRes.shop)
        setItems(itemsRes.items)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!shop || !user) {
      setCart(null)
      return
    }
    // Hydrates the cart on load/login. Uses a functional update so this can
    // never clobber a cart already set by an optimistic add-to-cart response
    // that resolved first (the two requests race, and the add is the one that
    // should win — it reflects the item the person just asked to add).
    api.getCart(shop.id).then((res) => setCart((prev) => prev ?? res.cart))
  }, [shop, user])

  // Does the actual network call, with no auth check — callers must already
  // know the user is signed in. Kept separate from `addToCart` so the
  // post-login retry never re-reads a stale `user` closure and loops back
  // into the auth prompt instead of completing the add.
  async function performAddToCart(itemId: number) {
    if (!shop) return
    setError(null)
    try {
      const res = await api.addCartItem(shop.id, itemId, 1)
      setCart(res.cart)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add to cart')
    }
  }

  async function addToCart(itemId: number) {
    if (!user) {
      setPendingItemId(itemId)
      setAuthOpen(true)
      return
    }
    await performAddToCart(itemId)
  }

  async function onAuthSuccess() {
    setAuthOpen(false)
    if (pendingItemId !== null) {
      await performAddToCart(pendingItemId)
      setPendingItemId(null)
    }
  }

  async function changeQuantity(cartItemId: number, quantity: number) {
    if (quantity < 1) {
      const res = await api.removeCartItem(cartItemId)
      setCart(res.cart)
      return
    }
    const res = await api.updateCartItem(cartItemId, quantity)
    setCart(res.cart)
  }

  if (loading) return <p>Loading…</p>
  if (notFound || !shop) return <p>This shop is not available.</p>

  return (
    <div>
      <Link to="/shops" className="muted">← All shops</Link>
      <h1>{shop.name}</h1>
      {shop.description && <p className="muted">{shop.description}</p>}
      <p className="tagline">
        {shop.fulfillment_methods.join(' · ')}
        {shop.address ? ` · ${shop.address}` : ''}
      </p>

      <h2 className="section">Menu</h2>
      {items.length === 0 && <p>No items listed yet.</p>}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className="card row spread">
            <div className="item-main">
              {item.photos[0] ? (
                <img className="thumb" src={`${API_ORIGIN}${item.photos[0].url}`} alt={item.name} />
              ) : (
                <div className="thumb tile" style={{ background: colorFor(item.name) }} aria-hidden>
                  {emojiFor(`${item.name} ${item.tags.map((t) => t.name).join(' ')}`)}
                </div>
              )}
              <div>
                <h3>{item.name}</h3>
                {item.description && <p className="muted">{item.description}</p>}
                {item.tags.length > 0 && <p className="muted small">{item.tags.map((t) => t.name).join(', ')}</p>}
              </div>
            </div>
            <div className="price-col">
              <strong>{formatPrice(item.price_cents, item.currency)}</strong>
              <button onClick={() => addToCart(item.id)}>Add to cart</button>
            </div>
          </li>
        ))}
      </ul>

      {error && <p role="alert" className="error">{error}</p>}

      {cart && cart.items.length > 0 && (
        <div className="card cart-summary">
          <h2 className="section">Your cart</h2>
          <ul className="list">
            {cart.items.map((line) => (
              <li key={line.id} className="row spread cart-line">
                <span>{line.name}</span>
                <div className="row gap">
                  <button className="qty-btn" onClick={() => changeQuantity(line.id, line.quantity - 1)} aria-label="Decrease quantity">−</button>
                  <span>{line.quantity}</span>
                  <button className="qty-btn" onClick={() => changeQuantity(line.id, line.quantity + 1)} aria-label="Increase quantity">+</button>
                  <strong className="line-total">{formatPrice(line.line_total_cents, line.currency)}</strong>
                </div>
              </li>
            ))}
          </ul>
          <div className="row spread cart-total">
            <strong>Subtotal</strong>
            <strong>{formatPrice(cart.subtotal_cents, cart.items[0]?.currency ?? 'PHP')}</strong>
          </div>
          <button onClick={() => setCheckoutDone(true)}>Checkout</button>
        </div>
      )}

      <AuthModal open={authOpen} onClose={() => { setAuthOpen(false); setPendingItemId(null) }} onSuccess={onAuthSuccess} />

      {checkoutDone && (
        <div className="modal-backdrop" onClick={() => setCheckoutDone(false)}>
          <div className="modal modal-done" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" aria-label="Close" onClick={() => setCheckoutDone(false)}>×</button>
            <h2>Your cart is saved 🎉</h2>
            <p className="muted">
              Ordering isn't live yet — we'll email you at <strong>{user?.email}</strong> the moment your
              community opens for real orders. Your cart will be waiting.
            </p>
            <button onClick={() => setCheckoutDone(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}
