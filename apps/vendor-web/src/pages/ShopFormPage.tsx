import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { FulfillmentMethod, Rating, Shop } from '../api/types'
import { TourCallout } from '../components/TourCallout'
import { RatingList, RatingSummary } from '../components/Ratings'

const METHODS: FulfillmentMethod[] = ['pickup', 'delivery']

interface ShopFormPageProps {
  /** Onboarding step 2 (OnboardingPage) renders this same component with
   * onboardingMode on, which layers sequential callouts over the opening
   * message/QR fields and the fulfillment checkboxes — the two things a
   * brand-new vendor won't intuit on their own. The form itself is
   * unchanged and fully usable with the tour skipped or absent. */
  onboardingMode?: boolean
  /** When set (onboarding), called instead of navigating to /shops on a
   * successful save, so the caller can advance to the next onboarding step. */
  onSaved?: () => void
}

export function ShopFormPage({ onboardingMode = false, onSaved }: ShopFormPageProps = {}) {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  // 0 = opening message/QR callout, 1 = fulfillment callout, 2 = tour done
  // (finished or skipped) — either way callouts stop rendering.
  const [tourStep, setTourStep] = useState(0)
  const showTour = onboardingMode && tourStep < 2

  const [shop, setShop] = useState<Shop | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [contact, setContact] = useState('')
  const [methods, setMethods] = useState<FulfillmentMethod[]>(['pickup'])
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null)
  const [openingMessage, setOpeningMessage] = useState('')
  const [openingMessagePhotos, setOpeningMessagePhotos] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [ratings, setRatings] = useState<Rating[]>([])

  useEffect(() => {
    // One shop per vendor for now — direct navigation to /shops/new after
    // already having one would otherwise hit a bare 422 from the API's
    // uniqueness validation. Onboarding's own creation step never hits this,
    // since it only renders once a vendor has zero shops.
    if (!editing && !onboardingMode) {
      api.listShops().then((res) => {
        if (res.shops.length > 0) navigate('/shops', { replace: true })
      })
    }
  }, [editing, onboardingMode, navigate])

  useEffect(() => {
    if (!editing) return
    api.getShop(Number(id)).then((res) => {
      const s = res.shop
      setShop(s)
      setName(s.name)
      setDescription(s.description ?? '')
      setAddress(s.address ?? '')
      setContact(s.contact_number ?? '')
      setMethods(s.fulfillment_methods)
      setOpeningMessage(s.opening_message ?? '')
    })
  }, [id, editing])

  // Read-only: vendors see their standing and what was said, but can't reply
  // to or remove a review. Only meaningful for a shop that already exists,
  // and only once we know its slug (the reviews endpoint is slug-keyed).
  useEffect(() => {
    if (!shop?.slug) return
    api.listShopRatings(shop.slug).then((res) => setRatings(res.ratings)).catch(() => setRatings([]))
  }, [shop?.slug])

  function toggleMethod(method: FulfillmentMethod) {
    setMethods((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.append('shop[name]', name)
    fd.append('shop[description]', description)
    fd.append('shop[address]', address)
    fd.append('shop[contact_number]', contact)
    methods.forEach((m) => fd.append('shop[fulfillment_methods][]', m))
    if (profilePhotoFile) fd.append('shop[profile_photo]', profilePhotoFile)
    if (coverPhotoFile) fd.append('shop[cover_photo]', coverPhotoFile)
    fd.append('shop[opening_message]', openingMessage)
    if (openingMessagePhotos) Array.from(openingMessagePhotos).forEach((f) => fd.append('shop[opening_message_photos][]', f))

    try {
      if (editing) await api.updateShop(Number(id), fd)
      else await api.createShop(fd)
      if (onSaved) onSaved()
      else navigate('/shops')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save shop')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card narrow">
      <div className="row spread">
        <h1>{editing ? 'Edit shop' : 'New shop'}</h1>
        {showTour && (
          <button type="button" className="tour-skip" onClick={() => setTourStep(2)}>
            Skip tour
          </button>
        )}
      </div>
      <form onSubmit={onSubmit}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label>
          Address (unit / building)
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label>
          Contact number
          <input value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>

        <div className="tour-anchor">
          <fieldset>
            <legend>Fulfillment</legend>
            {METHODS.map((m) => (
              <label key={m} className="inline">
                <input type="checkbox" checked={methods.includes(m)} onChange={() => toggleMethod(m)} />
                {m}
              </label>
            ))}
          </fieldset>
          {showTour && tourStep === 1 && (
            <TourCallout
              message="Pickup or delivery changes how the order flows after it's placed — pick what you actually offer."
              nextLabel="Got it"
              onNext={() => setTourStep(2)}
              onSkip={() => setTourStep(2)}
            />
          )}
        </div>

        {/* Plain uploads for now — cropping to fixed aspect ratios is a
            follow-up pass, not built yet. */}
        <label>
          Profile picture (JPEG/PNG/WebP)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setProfilePhotoFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {shop?.profile_photo && (
          <div className="thumbs">
            <img src={`http://localhost:3000${shop.profile_photo.url}`} alt={shop.profile_photo.filename} />
          </div>
        )}

        <label>
          Cover photo (JPEG/PNG/WebP)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setCoverPhotoFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {shop?.cover_photo && (
          <div className="thumbs">
            <img src={`http://localhost:3000${shop.cover_photo.url}`} alt={shop.cover_photo.filename} />
          </div>
        )}

        <div className="tour-anchor">
          <fieldset>
            <legend>Opening message</legend>
            <p className="muted">
              Pinned at the top of every order's chat with this shop, so customers always see it —
              how to pay you (GCash, bank transfer, etc.), hours, or anything else worth repeating.
              The app never processes payment itself. Add one QR code per payment option you accept.
            </p>
            <label>
              Message
              <textarea
                value={openingMessage}
                onChange={(e) => setOpeningMessage(e.target.value)}
                placeholder="e.g. GCash to 0917-xxx-xxxx. Please send proof of payment here."
              />
            </label>
            <label>
              QR codes (JPEG/PNG/WebP, up to 5)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                onChange={(e) => setOpeningMessagePhotos(e.target.files)}
              />
            </label>
            {shop && shop.opening_message_photos && shop.opening_message_photos.length > 0 && (
              <div className="thumbs">
                {shop.opening_message_photos.map((p) => (
                  <img key={p.id} src={`http://localhost:3000${p.url}`} alt={p.filename} />
                ))}
              </div>
            )}
          </fieldset>
          {showTour && tourStep === 0 && (
            <TourCallout
              message="This is how you get paid. There's no payment processing in this app — write how customers should pay you (GCash number, bank details, etc.) and add a QR code if you have one. It's pinned above every order's chat."
              nextLabel="Got it"
              strong
              placement="top"
              onNext={() => setTourStep(1)}
              onSkip={() => setTourStep(2)}
            />
          )}
        </div>

        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save shop'}</button>
      </form>

      {editing && shop && (
        <section>
          <h2>Reviews</h2>
          <p>
            <RatingSummary
              averageRating={shop.average_rating}
              ratingsCount={shop.ratings_count}
              emptyLabel="No reviews yet."
            />
          </p>
          {ratings.length > 0 && <RatingList ratings={ratings} />}
        </section>
      )}
    </div>
  )
}
