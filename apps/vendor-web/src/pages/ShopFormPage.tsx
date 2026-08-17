import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { FulfillmentMethod, Shop } from '../api/types'
import { TourCallout } from '../components/TourCallout'
import { HelpTourButton } from '../components/HelpTourButton'
import { ImageCropModal } from '../components/ImageCropModal'
import { useMyShopState } from '../useMyShop'

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

export function ShopFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()
  const { setShop: setMyShop } = useMyShopState()
  // Numbered top-to-bottom, matching the form's own field order: 0 = name/
  // description, 1 = building/tower, 2 = fulfillment, 3 = shop photos,
  // 4 = opening message/QR — an optional, on-demand tour behind the "?"
  // button (HelpTourButton), not shown automatically.
  const [tourOpen, setTourOpen] = useState(false)
  const [tourStep, setTourStep] = useState(0)
  const showTour = tourOpen && tourStep < 5

  function openTour() {
    setTourOpen(true)
    setTourStep(0)
  }

  function closeTour() {
    setTourOpen(false)
    setTourStep(0)
  }

  const [shop, setShop] = useState<Shop | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [building, setBuilding] = useState('')
  const [address, setAddress] = useState('')
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
    // One shop per vendor — direct navigation to /shops/new after already
    // having one would otherwise hit a bare 422 from the API's uniqueness
    // validation.
    if (!editing) {
      api.listShops().then((res) => {
        if (res.shops.length > 0) navigate('/shops', { replace: true })
      })
    }
  }, [editing, navigate])

  useEffect(() => {
    if (!editing) return
    api.getShop(Number(id)).then((res) => {
      const s = res.shop
      setShop(s)
      setName(s.name)
      setDescription(s.description ?? '')
      setBuilding(s.building ?? '')
      setAddress(s.address ?? '')
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
    methods.forEach((m) => fd.append('shop[fulfillment_methods][]', m))
    if (profilePhotoFile) fd.append('shop[profile_photo]', profilePhotoFile)
    if (coverPhotoFile) fd.append('shop[cover_photo]', coverPhotoFile)
    fd.append('shop[opening_message]', openingMessage)
    if (openingMessagePhotos) Array.from(openingMessagePhotos).forEach((f) => fd.append('shop[opening_message_photos][]', f))

    try {
      // Push the result into the shared MyShopProvider context directly,
      // rather than letting ShopDashboardPage/TabBar rediscover it via a
      // fetch after navigating — a fetch here would race the new route's
      // own mount (see useMyShop.tsx).
      const res = editing ? await api.updateShop(Number(id), fd) : await api.createShop(fd)
      setMyShop(res.shop)
      navigate('/shops')
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
        {editing && (
          <Link className="button" to={`/shops/${id}/preview`} state={{ from: 'edit' }}>
            Preview shop
          </Link>
        )}
      </div>
      <HelpTourButton onClick={openTour} label="Tour this form" />
      <form onSubmit={onSubmit}>
        <div className="tour-anchor">
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          {showTour && tourStep === 0 && (
            <TourCallout
              message="Start with your shop's name and a short description — this is the first thing customers see when they find you."
              nextLabel="Got it"
              placement="bottom"
              onNext={() => setTourStep(1)}
              onSkip={closeTour}
            />
          )}
        </div>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>

        <div className="tour-anchor">
          <label>
            Building / Tower
            <input value={building} onChange={(e) => setBuilding(e.target.value)} required />
            <p className="muted small">
              Shown publicly on your shop page — customers see this, but never your exact unit.
            </p>
          </label>
          {showTour && tourStep === 1 && (
            <TourCallout
              message="This is the public location shown to customers browsing the community — pick the tower/building they'll actually see."
              nextLabel="Got it"
              placement="bottom"
              onNext={() => setTourStep(2)}
              onSkip={closeTour}
            />
          )}
        </div>
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
          {showTour && tourStep === 2 && (
            <TourCallout
              message="Pickup or delivery changes how the order flows after it's placed — pick what you actually offer."
              nextLabel="Got it"
              onNext={() => setTourStep(3)}
              onSkip={closeTour}
            />
          )}
        </div>

        <div className="tour-anchor">
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
          {showTour && tourStep === 3 && (
            <TourCallout
              message="Add a profile picture and cover photo so your shop stands out. Skip it for now if you want — we'll show a placeholder tile until you do."
              nextLabel="Got it"
              placement="bottom"
              onNext={() => setTourStep(4)}
              onSkip={closeTour}
            />
          )}
        </div>

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
          {showTour && tourStep === 4 && (
            <TourCallout
              message="This is how you get paid. There's no payment processing in this app — write how customers should pay you (GCash number, bank details, etc.) and add a QR code if you have one. It's pinned above every order's chat."
              nextLabel="Got it"
              strong
              placement="top"
              onNext={closeTour}
              onSkip={closeTour}
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
