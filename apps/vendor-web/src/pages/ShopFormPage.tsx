import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { FulfillmentMethod, Shop } from '../api/types'
import { TourCallout } from '../components/TourCallout'
import { ImageCropModal } from '../components/ImageCropModal'

const METHODS: FulfillmentMethod[] = ['pickup', 'delivery']

// Facebook's own conventions: a square identity thumbnail and a wide banner.
// Both are cropped client-side to these exact ratios before upload, so the
// customer-side list card and shop-detail hero never have to letterbox.
type PhotoField = 'profile_photo' | 'cover_photo'

const PHOTO_FIELDS: Record<PhotoField, { aspect: number; title: string; hint: string; maxWidth: number }> = {
  profile_photo: {
    aspect: 1,
    title: 'Crop your profile picture',
    hint: 'Square. This is the thumbnail customers see next to your shop name.',
    maxWidth: 1024,
  },
  cover_photo: {
    aspect: 3,
    title: 'Crop your cover photo',
    hint: 'Wide banner. This runs across the top of your shop page.',
    maxWidth: 1920,
  },
}

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
  const [building, setBuilding] = useState('')
  const [address, setAddress] = useState('')
  const [contact, setContact] = useState('')
  const [methods, setMethods] = useState<FulfillmentMethod[]>(['pickup'])
  // Cropped output, not the file the vendor picked — the raw file only ever
  // lives inside the crop dialog.
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null)
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  // The file waiting to be cropped, and which field it belongs to. Non-null
  // means the crop dialog is open.
  const [cropping, setCropping] = useState<{ field: PhotoField; file: File } | null>(null)
  const [openingMessage, setOpeningMessage] = useState('')
  const [openingMessagePhotos, setOpeningMessagePhotos] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

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
      setBuilding(s.building ?? '')
      setAddress(s.address ?? '')
      setContact(s.contact_number ?? '')
      setMethods(s.fulfillment_methods)
      setOpeningMessage(s.opening_message ?? '')
    })
  }, [id, editing])

  // Object URLs for the cropped previews, revoked when replaced or on unmount.
  useEffect(() => () => {
    if (profilePreview) URL.revokeObjectURL(profilePreview)
  }, [profilePreview])
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
  }, [coverPreview])

  function toggleMethod(method: FulfillmentMethod) {
    setMethods((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]))
  }

  function pickPhoto(field: PhotoField, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    // Clear the input so cancelling the crop and re-picking the same file
    // still fires a change event.
    e.target.value = ''
    if (file) setCropping({ field, file })
  }

  function onCropConfirmed(cropped: File) {
    if (!cropping) return
    if (cropping.field === 'profile_photo') {
      setProfilePhotoFile(cropped)
      setProfilePreview(URL.createObjectURL(cropped))
    } else {
      setCoverPhotoFile(cropped)
      setCoverPreview(URL.createObjectURL(cropped))
    }
    setCropping(null)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.append('shop[name]', name)
    fd.append('shop[description]', description)
    fd.append('shop[building]', building)
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
      {/* Editing is reached straight from the dashboard, and until now the
          only way out was the browser's back button. */}
      {editing && (
        <p className="back-link">
          <Link className="button" to="/shops">← Back to dashboard</Link>
        </p>
      )}
      <div className="row spread">
        <h1>{editing ? 'Edit shop' : 'New shop'}</h1>
        {editing && <Link className="button" to={`/shops/${id}/preview`}>Preview shop</Link>}
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
          Building / Tower
          <input value={building} onChange={(e) => setBuilding(e.target.value)} />
          <p className="muted small">
            Shown publicly on your shop page — customers see this, but never your exact unit.
          </p>
        </label>
        <label>
          Unit number (private)
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Unit 7A"
          />
          <p className="muted small">
            Never shown to customers browsing your shop. Share it privately in your opening
            message if a customer needs it to pick up or receive a delivery.
          </p>
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

        <fieldset className="photo-field">
          <legend>Shop photos</legend>

          <label>
            Profile picture (square, JPEG/PNG/WebP)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => pickPhoto('profile_photo', e)}
            />
          </label>
          {profilePreview ? (
            <div className="photo-preview-row">
              <img className="photo-preview square" src={profilePreview} alt="Cropped profile picture preview" />
              <p className="muted">Cropped. Save the shop to upload it.</p>
            </div>
          ) : (
            shop?.profile_photo && (
              <div className="photo-preview-row">
                <img
                  className="photo-preview square"
                  src={`http://localhost:3000${shop.profile_photo.url}`}
                  alt={shop.profile_photo.filename}
                />
                <p className="muted">Current profile picture.</p>
              </div>
            )
          )}

          <label>
            Cover photo (wide banner, JPEG/PNG/WebP)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => pickPhoto('cover_photo', e)}
            />
          </label>
          {coverPreview ? (
            <div className="photo-preview-row">
              <img className="photo-preview wide" src={coverPreview} alt="Cropped cover photo preview" />
              <p className="muted">Cropped. Save the shop to upload it.</p>
            </div>
          ) : (
            shop?.cover_photo && (
              <div className="photo-preview-row">
                <img
                  className="photo-preview wide"
                  src={`http://localhost:3000${shop.cover_photo.url}`}
                  alt={shop.cover_photo.filename}
                />
                <p className="muted">Current cover photo.</p>
              </div>
            )
          )}
        </fieldset>

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

      {/* Outside the <form> on purpose: a fixed-position overlay renders the
          same anywhere, and nothing inside it can accidentally submit. */}
      {cropping && (
        <ImageCropModal
          key={cropping.field}
          file={cropping.file}
          aspect={PHOTO_FIELDS[cropping.field].aspect}
          title={PHOTO_FIELDS[cropping.field].title}
          hint={PHOTO_FIELDS[cropping.field].hint}
          maxWidth={PHOTO_FIELDS[cropping.field].maxWidth}
          onCancel={() => setCropping(null)}
          onConfirm={onCropConfirmed}
        />
      )}
    </div>
  )
}
