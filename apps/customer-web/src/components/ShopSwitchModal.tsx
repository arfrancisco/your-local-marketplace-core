import { useCart } from '../CartContext'

// One-shop-at-a-time cart policy: shown when the customer tries to add an
// item from a shop different than the one their active (non-empty) cart
// belongs to. Confirming clears the old shop's cart and starts a new one for
// the shop they just tried to add from — declining leaves everything as-is.
export function ShopSwitchModal() {
  const { pendingShopSwitch, confirmShopSwitch, cancelShopSwitch } = useCart()
  if (!pendingShopSwitch) return null

  const { fromShop, toShop } = pendingShopSwitch

  return (
    <div className="modal-backdrop" onClick={cancelShopSwitch}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Replace your cart?"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Replace your cart?</h2>
        <p>
          Your cart has items from <strong>{fromShop.name}</strong>. You can only order from one
          shop at a time — adding something from <strong>{toShop.name}</strong> will clear that
          cart and start a new one.
        </p>
        <div className="row spread" style={{ marginTop: '1rem' }}>
          <button type="button" className="link" onClick={cancelShopSwitch}>
            Cancel
          </button>
          <button type="button" onClick={confirmShopSwitch}>
            Replace cart
          </button>
        </div>
      </div>
    </div>
  )
}
