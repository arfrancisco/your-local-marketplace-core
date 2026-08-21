import type { ReactNode } from 'react'
import type { Item, Shop } from '../api/types'
import { colorFor, emojiFor } from '../visuals'
import { RatingSummary } from './Ratings'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Photos normally arrive as API-relative paths ("/rails/blob/…"). The
// onboarding wizard also feeds this component not-yet-uploaded crops as
// blob: URLs so its live preview can show them before the shop is saved,
// and those are already absolute.
function photoSrc(url: string) {
  return /^(blob:|data:|https?:)/.test(url) ? url : `${API_ORIGIN}${url}`
}

// Matches customer-web's own BackArrowIcon — a real stroked icon reads as a
// tappable button against a photo; the Unicode "←" glyph was too thin.
function BackArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M19 12H5M12 19l-7-7 7-7"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface ShopPreviewProps {
  shop: Shop
  /** Already filtered to what a customer would see (enabled items). */
  items: Item[]
  /** Rendered inside the hero's `.tour-anchor`, for an opt-in tour callout. */
  heroAddon?: ReactNode
  /** The decorative in-hero back button a customer would see. Off inside
   * the onboarding wizard's small preview accordion, where it would just
   * be clutter. */
  showBackAffordance?: boolean
}

/**
 * The customer-facing rendering of a shop: cover-photo hero, identity card,
 * catalog. Read-only, with no cart or add-to-cart — this is a look, not a
 * transaction.
 *
 * Extracted out of ShopPreviewPage so the onboarding wizard's live preview
 * accordion shows exactly the same markup rather than a second, drifting
 * copy of it. ShopPreviewPage still owns everything around this (back link,
 * preview/demo banners, the reviews section and its own fetching).
 */
export function ShopPreview({ shop, items, heroAddon, showBackAffordance }: ShopPreviewProps) {
  const fallbackKey = `${shop.name} ${shop.description ?? ''}`

  return (
    <>
      <div className="shop-hero tour-anchor">
        {shop.cover_photo ? (
          <img className="shop-cover" src={photoSrc(shop.cover_photo.url)} alt="" />
        ) : (
          <div className="shop-cover tile" style={{ background: colorFor(shop.name) }} aria-hidden>
            {emojiFor(fallbackKey)}
          </div>
        )}
        {showBackAffordance && (
          <span className="shop-back" aria-hidden>
            <BackArrowIcon />
          </span>
        )}
        <div className="shop-identity">
          {shop.profile_photo ? (
            <img className="shop-avatar" src={photoSrc(shop.profile_photo.url)} alt="" />
          ) : (
            <div className="shop-avatar tile" style={{ background: colorFor(shop.name) }} aria-hidden>
              {emojiFor(fallbackKey)}
            </div>
          )}
          <div className="shop-identity-text">
            <div className="shop-card-top">
              <h1>{shop.name}</h1>
              {shop.ratings_count > 0 && (
                <RatingSummary averageRating={shop.average_rating} ratingsCount={shop.ratings_count} />
              )}
            </div>
            {shop.description && <p className="muted shop-description">{shop.description}</p>}
            <p className="tagline">
              {shop.fulfillment_methods.join(' · ')}
              {shop.building ? ` · ${shop.building}` : ''}
            </p>
            {shop.verified && (
              <div className="shop-card-badges">
                <span className="verified-tag">Verified</span>
              </div>
            )}
          </div>
        </div>
        {heroAddon}
      </div>

      <h2 className="section">Catalog</h2>
      {items.length === 0 && <p>No items listed yet.</p>}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id} className={`card row spread item-row ${item.sold_out ? 'dimmed' : ''}`}>
            <div className="item-main">
              {item.photos[0] ? (
                <img className="thumb" src={photoSrc(item.photos[0].url)} alt={item.name} />
              ) : (
                <div className="thumb tile" style={{ background: colorFor(item.name) }} aria-hidden>
                  {emojiFor(`${item.name} ${item.tags.map((t) => t.name).join(' ')}`)}
                </div>
              )}
              <div>
                <h3>{item.name}</h3>
                {item.description && <p className="muted">{item.description}</p>}
                {item.tags.length > 0 && <p className="muted small">{item.tags.map((t) => t.name).join(', ')}</p>}
                {item.sold_out && <p className="sold-out-label">Sold out</p>}
              </div>
            </div>
            <div className="price-col">
              <strong>{formatPrice(item.price_cents, item.currency)}</strong>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}
