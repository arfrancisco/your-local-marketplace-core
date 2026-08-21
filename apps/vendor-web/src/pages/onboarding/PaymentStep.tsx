import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../api/client'
import { OpeningMessageFields } from '../../components/OpeningMessageFields'
import { useMyShopState } from '../../useMyShop'
import { OnboardingStepShell, useOnboarding } from './OnboardingLayout'

// Step 4, the last one — this is where a vendor says how they get paid
// (ADR 0009: no payment gateway, the opening message is the mechanism), and
// where onboarding actually ends.
export function PaymentStep() {
  const { shop } = useOnboarding()
  const { setShop } = useMyShopState()
  const navigate = useNavigate()
  const [message, setMessage] = useState(shop?.opening_message ?? '')
  const [photos, setPhotos] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function finish({ save, open }: { save: boolean; open: boolean }) {
    if (!shop) return
    setError(null)
    setBusy(true)
    try {
      if (save) {
        const fd = new FormData()
        fd.append('shop[opening_message]', message)
        if (photos) Array.from(photos).forEach((f) => fd.append('shop[opening_message_photos][]', f))
        const saved = await api.updateShop(shop.id, fd)
        setShop(saved.shop)
      }
      // The API owns the "can this shop open?" rule (an opening message and
      // at least one enabled item). No client-side pre-check here on
      // purpose — a second copy of that rule would drift. If it refuses,
      // the message it returns is what gets shown.
      const res = open ? await api.completeOnboarding(shop.id, true) : await api.completeOnboarding(shop.id)
      setShop(res.shop)
      navigate('/shops')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not finish setting up your shop')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OnboardingStepShell
      step="payment"
      heading="How do customers pay you?"
      intro="This app never handles money. Whatever you write here is pinned above every order's chat, so each customer sees it the moment they order."
      error={error}
      actions={
        <>
          <button type="button" disabled={busy} onClick={() => finish({ save: true, open: true })}>
            {busy ? 'Working…' : 'Open my shop'}
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => finish({ save: true, open: false })}
          >
            Finish, keep it closed
          </button>
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => finish({ save: false, open: false })}
          >
            Skip for now
          </button>
        </>
      }
      footnote="Opening puts your shop in the marketplace. Neighbors can find it and place orders right away, and you can close it again anytime from your dashboard."
    >
      <OpeningMessageFields
        message={message}
        onMessageChange={setMessage}
        onPhotosChange={setPhotos}
        existingPhotos={shop?.opening_message_photos}
      />
    </OnboardingStepShell>
  )
}
