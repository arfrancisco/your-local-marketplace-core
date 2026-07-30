import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Item, Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'
import { EarlyAccessModal } from '../components/EarlyAccessModal'
import { ItemDetailModal } from '../components/ItemDetailModal'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Cart-building is still "deciding," not "ordering" — so, like browsing, it
// stays free of any account. The cart lives in this browser (localStorage per
// shop) rather than the authenticated backend cart; only "Checkout" prompts
// for anything, and that's still just the lightweight early-access signup,
// not a real account. The persisted backend cart (Cart/CartItem) is real and
// tested, ready for when M3 ties checkout to real accounts and orders — this
// page just doesn't call it yet.
function cartStorageKey(shopId: number) {
  return `cart:${shopId}`
}

export function ShopDetailPage() {
  const { slug } = useParams()

  const [shop, setShop] = useState<Shop | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [viewingItem, setViewingItem] = useState<Item | null>(null)

  useEffect(() => {
    if (!slug) return
    Promise.all([api.getShop(slug), api.listItems(slug)])
      .then(([shopRes, itemsRes]) => {
        setShop(shopRes.shop)
        setItems(itemsRes.items)
        const saved = localStorage.getItem(cartStorageKey(shopRes.shop.id))
        if (saved) setQuantities(JSON.parse(saved))
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  useEffect(() => {
    if (!shop) return
    localStorage.setItem(cartStorageKey(shop.id), JSON.stringify(quantities))
  }, [shop, quantities])

  function addToCart(itemId: number) {
    setQuantities((prev) => ({ ...prev, [itemId]: (prev[itemId] ?? 0) + 1 }))
  }

  function changeQuantity(itemId: number, quantity: number) {
    setQuantities((prev) => {
      const next = { ...prev }
      if (quantity < 1) delete next[itemId]
      else next[itemId] = quantity
      return next
    })
  }

  const cartLines = items
    .filter((item) => quantities[item.id] > 0)
    .map((item) => ({ item, quantity: quantities[item.id] }))
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
              <button onClick={() => addToCart(item.id)}>Add to cart</button>
            </div>
          </li>
        ))}
      </ul>

      {cartLines.length > 0 && (
        <div className="card cart-summary">
          <h2 className="section">Your cart</h2>
          <ul className="list">
            {cartLines.map(({ item, quantity }) => (
              <li key={item.id} className="row spread cart-line">
                <span>{item.name}</span>
                <div className="row gap">
                  <button className="qty-btn" onClick={() => changeQuantity(item.id, quantity - 1)} aria-label="Decrease quantity">−</button>
                  <span>{quantity}</span>
                  <button className="qty-btn" onClick={() => changeQuantity(item.id, quantity + 1)} aria-label="Increase quantity">+</button>
                  <strong className="line-total">{formatPrice(quantity * item.price_cents, item.currency)}</strong>
                </div>
              </li>
            ))}
          </ul>
          <div className="row spread cart-total">
            <strong>Subtotal</strong>
            <strong>{formatPrice(subtotalCents, cartLines[0].item.currency)}</strong>
          </div>
          <button onClick={() => setCheckoutOpen(true)}>Checkout</button>
        </div>
      )}

      <EarlyAccessModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        context={`${shop.name} — checkout (${cartCount} item${cartCount === 1 ? '' : 's'}, ${formatPrice(subtotalCents, cartLines[0]?.item.currency ?? 'PHP')})`}
      />

      <ItemDetailModal
        item={viewingItem}
        onClose={() => setViewingItem(null)}
        onAddToCart={(item) => addToCart(item.id)}
      />
    </div>
  )
}
