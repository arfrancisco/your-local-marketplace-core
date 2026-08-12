import { useCart } from '../CartContext'
import { DragToConfirmButton } from './DragToConfirmButton'

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// The cart used to be an inline card sitting in ShopDetailPage's document flow,
// then a right-anchored drawer. It is a bottom sheet now, opened from the
// cart icon in the fixed bottom bar (App.tsx's BottomBar) — anchoring the
// sheet to the bottom keeps the qty steppers and "Place order" near where the
// thumb already is, instead of reaching up to a dialog floating mid-screen.
// Shares the .modal-backdrop/.modal convention with every other overlay in
// this app; .sheet is what pins it to the bottom edge instead of centering it.
export function CartModal() {
  const {
    shop,
    lines,
    count,
    subtotalCents,
    currency,
    isOpen,
    closeCart,
    fulfillmentMethod,
    setFulfillmentMethod,
    placingOrder,
    checkoutError,
    hasSoldOutInCart,
    changeQuantity,
    placeOrder,
  } = useCart()

  if (!isOpen) return null

  return (
    <div className="modal-backdrop" onClick={closeCart}>
      <div
        className="modal sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="modal-close" aria-label="Close cart" onClick={closeCart}>×</button>
        <h2>Your cart</h2>

        {lines.length === 0 ? (
          <p className="muted">Your cart is empty.</p>
        ) : (
          <>
            <ul className="list">
              {lines.map(({ item, quantity }) => (
                <li key={item.id} className="cart-line">
                  <div className="row spread">
                    <span>{item.name}</span>
                    <div className="row gap">
                      <button
                        className="qty-btn"
                        onClick={() => changeQuantity(item.id, quantity - 1)}
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span>{quantity}</span>
                      <button
                        className="qty-btn"
                        onClick={() => changeQuantity(item.id, quantity + 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                      <strong className="line-total">
                        {formatPrice(quantity * item.price_cents, item.currency)}
                      </strong>
                    </div>
                  </div>
                  {item.sold_out && (
                    <p role="alert" className="error small">
                      This item has gone sold out — remove it to check out.
                    </p>
                  )}
                </li>
              ))}
            </ul>

            <div className="row spread cart-total">
              <strong>Subtotal</strong>
              <strong>{formatPrice(subtotalCents, currency)}</strong>
            </div>

            {shop && shop.fulfillment_methods.length > 1 && (
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

            {shop?.demo && (
              <p className="demo-cart-warning" role="alert">
                This is a demo shop. Placing an order here is not real — it
                will not be prepared or delivered.
              </p>
            )}

            {checkoutError && <p role="alert" className="error">{checkoutError}</p>}
            <DragToConfirmButton
              label={
                shop?.demo
                  ? `Drag to place demo order (${count} item${count === 1 ? '' : 's'})`
                  : `Drag to place order (${count} item${count === 1 ? '' : 's'})`
              }
              pendingLabel="Placing order…"
              onConfirm={placeOrder}
              disabled={hasSoldOutInCart}
              pending={placingOrder}
            />
          </>
        )}
      </div>
    </div>
  )
}
