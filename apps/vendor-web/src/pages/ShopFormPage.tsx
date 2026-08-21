import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { Shop } from '../api/types'
import { TourCallout } from '../components/TourCallout'
import { HelpTourButton } from '../components/HelpTourButton'
import { appendShopBasics, ShopBasicsFields, type ShopBasics } from '../components/ShopBasicsFields'
import { OpeningMessageFields } from '../components/OpeningMessageFields'
import { ShopPhotoFields, type PhotoField } from '../components/ShopPhotoFields'
import { useMyShopState } from '../useMyShop'

const EMPTY_BASICS: ShopBasics = {
  name: '',
  description: '',
  building: '',
  address: '',
  methods: ['pickup'],
}

// The single-page shop editor. Deliberately *not* a wizard: onboarding owns
// the step-by-step flow (see pages/onboarding/), and a vendor coming back to
// change one field should see every field at once. The field groups
// themselves are shared with that wizard so the two can never drift.
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
  const [basics, setBasics] = useState<ShopBasics>(EMPTY_BASICS)
  // Cropped output, not the file the vendor picked — the raw file only ever
  // lives inside the crop dialog (ShopPhotoFields).
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null)
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
      setBasics({
        name: s.name,
        description: s.description ?? '',
        building: s.building ?? '',
        address: s.address ?? '',
        methods: s.fulfillment_methods,
      })
      setOpeningMessage(s.opening_message ?? '')
    })
  }, [id, editing])

  function onPhotoChange(field: PhotoField, file: File) {
    if (field === 'profile_photo') setProfilePhotoFile(file)
    else setCoverPhotoFile(file)
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData()
    appendShopBasics(fd, basics)
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
        <ShopBasicsFields
          values={basics}
          onChange={(patch) => setBasics((prev) => ({ ...prev, ...patch }))}
          nameAddon={
            showTour && tourStep === 0 && (
              <TourCallout
                message="Start with your shop's name and a short description — this is the first thing customers see when they find you."
                nextLabel="Got it"
                placement="bottom"
                onNext={() => setTourStep(1)}
                onSkip={closeTour}
              />
            )
          }
          buildingAddon={
            showTour && tourStep === 1 && (
              <TourCallout
                message="This is the public location shown to customers browsing the community — pick the tower/building they'll actually see."
                nextLabel="Got it"
                placement="bottom"
                onNext={() => setTourStep(2)}
                onSkip={closeTour}
              />
            )
          }
          fulfillmentAddon={
            showTour && tourStep === 2 && (
              <TourCallout
                message="Pickup or delivery changes how the order flows after it's placed — pick what you actually offer."
                nextLabel="Got it"
                onNext={() => setTourStep(3)}
                onSkip={closeTour}
              />
            )
          }
        />

        <div className="tour-anchor">
          <ShopPhotoFields
            profilePhoto={shop?.profile_photo}
            coverPhoto={shop?.cover_photo}
            onPhotoChange={onPhotoChange}
            addon={
              showTour && tourStep === 3 && (
                <TourCallout
                  message="Add a profile picture and cover photo so your shop stands out. Skip it for now if you want — we'll show a placeholder tile until you do."
                  nextLabel="Got it"
                  placement="bottom"
                  onNext={() => setTourStep(4)}
                  onSkip={closeTour}
                />
              )
            }
          />
        </div>

        <div className="tour-anchor">
          <OpeningMessageFields
            message={openingMessage}
            onMessageChange={setOpeningMessage}
            onPhotosChange={setOpeningMessagePhotos}
            existingPhotos={shop?.opening_message_photos}
            addon={
              showTour && tourStep === 4 && (
                <TourCallout
                  message="This is how you get paid. There's no payment processing in this app — write how customers should pay you (GCash number, bank details, etc.) and add a QR code if you have one. It's pinned above every order's chat."
                  nextLabel="Got it"
                  strong
                  placement="top"
                  onNext={closeTour}
                  onSkip={closeTour}
                />
              )
            }
          />
        </div>

        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save shop'}</button>
      </form>
    </div>
  )
}
