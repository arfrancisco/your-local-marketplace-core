import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth'
import type { FulfillmentMethod, Item, Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'
import { ItemDetailModal } from '../components/ItemDetailModal'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// The real, persisted backend cart (Cart/CartItem, ADR 0008) — adding to it
// requires a real account, which is the moment browsing turns into ordering.
// Checkout converts it into a real order (M3/ADR 0009).
export function ShopDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [shop, setShop] = useState<Shop | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [cartLines, setCartLines] = useState<
    { cartItemId: number; item: Item; quantity: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [viewingItem, setViewingItem] = useState<Item | null>(null)
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod | null>(null)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    setLoading(true)
    Promise.all([api.getShop(slug), api.listItems(slug)])
      .then(([shopRes, itemsRes]) => {
        setShop(shopRes.shop)
        setItems(itemsRes.items)
        const methods = shopRes.shop.fulfillment_methods
        setFulfillmentMethod((methods.includes('delivery') ? 'delivery' : methods[0]) ?? null)
        if (!user) return
        return api.getCart(shopRes.shop.id).then((cartRes) => {
          if (!cartRes.cart) return
          const byItemId = new Map(itemsRes.items.map((i) => [i.id, i]))
          setCartLines(
            cartRes.cart.items
              .map((line) => ({ cartItemId: line.id, item: byItemId.get(line.item_id)!, quantity: line.quantity }))
              .filter((l) => l.item)
          )
        })
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug, user])

  function requireLogin() {
    navigate(`/login?return_to=${encodeURIComponent(`/shops/${slug}`)}`)
  }

  async function addToCart(item: Item) {
    if (!user || !shop) return requireLogin()
    const res = await api.addCartItem(shop.id, item.id)
    const line = res.cart.items.find((l) => l.item_id === item.id)!
    setCartLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id)
      if (existing) return prev.map((l) => (l.item.id === item.id ? { ...l, quantity: line.quantity, cartItemId: line.id } : l))
      return [...prev, { cartItemId: line.id, item, quantity: line.quantity }]
    })
  }

  async function changeQuantity(cartItemId: number, itemId: number, quantity: number) {
    if (quantity < 1) {
      await api.removeCartItem(cartItemId)
      setCartLines((prev) => prev.filter((l) => l.item.id !== itemId))
      return
    }
    await api.updateCartItem(cartItemId, quantity)
    setCartLines((prev) => prev.map((l) => (l.item.id === itemId ? { ...l, quantity } : l)))
  }

  async function placeOrder() {
    if (!shop || !fulfillmentMethod) return
    setCheckoutError(null)
    setPlacingOrder(true)
    try {
      const res = await api.checkout(shop.id, fulfillmentMethod)
      navigate(`/orders/${res.order.id}`)
    } catch (err) {
      setCheckoutError(err instanceof ApiError ? err.message : 'Could not place order')
    } finally {
      setPlacingOrder(false)
    }
  }

  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0)
  const subtotalCents = cartLines.reduce((sum, line) => sum + line.quantity * line.item.price_cents, 0)

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
            <button className="item-main clickable" onClick={() => setViewingItem(item)} aria-label={`View ${item.name}`}>
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
            </button>
            <div className="price-col">
              <strong>{formatPrice(item.price_cents, item.currency)}</strong>
              <button onClick={() => addToCart(item)}>Add to cart</button>
            </div>
          </li>
        ))}
      </ul>

      {cartLines.length > 0 && (
        <div className="card cart-summary">
          <h2 className="section">Your cart</h2>
          <ul className="list">
            {cartLines.map(({ cartItemId, item, quantity }) => (
              <li key={item.id} className="row spread cart-line">
                <span>{item.name}</span>
                <div className="row gap">
                  <button className="qty-btn" onClick={() => changeQuantity(cartItemId, item.id, quantity - 1)} aria-label="Decrease quantity">−</button>
                  <span>{quantity}</span>
                  <button className="qty-btn" onClick={() => changeQuantity(cartItemId, item.id, quantity + 1)} aria-label="Increase quantity">+</button>
                  <strong className="line-total">{formatPrice(quantity * item.price_cents, item.currency)}</strong>
                </div>
              </li>
            ))}
          </ul>
          <div className="row spread cart-total">
            <strong>Subtotal</strong>
            <strong>{formatPrice(subtotalCents, cartLines[0].item.currency)}</strong>
          </div>

          {shop.fulfillment_methods.length > 1 && (
            <fieldset>
              <legend>Fulfillment</legend>
              {shop.fulfillment_methods.map((m) => (
                <label key={m} className="inline">
                  <input
                    type="radio"
                    name="fulfillment_method"
                    checked={fulfillmentMethod === m}
                    onChange={() => setFulfillmentMethod(m)}
                  />
                  {m}
                </label>
              ))}
            </fieldset>
          )}

          {checkoutError && <p role="alert" className="error">{checkoutError}</p>}
          <button onClick={placeOrder} disabled={placingOrder}>
            {placingOrder ? 'Placing order…' : `Place order (${cartCount} item${cartCount === 1 ? '' : 's'})`}
          </button>
        </div>
      )}

      <ItemDetailModal item={viewingItem} onClose={() => setViewingItem(null)} onAddToCart={addToCart} />
    </div>
  )
}
