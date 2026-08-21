import type { ReactNode } from 'react'
import type { Photo } from '../api/types'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

interface OpeningMessageFieldsProps {
  message: string
  onMessageChange: (value: string) => void
  onPhotosChange: (files: FileList | null) => void
  /** QR codes already uploaded on this shop. */
  existingPhotos?: Photo[]
  /** Rendered inside the fieldset's own `.tour-anchor` wrapper. */
  addon?: ReactNode
}

/**
 * The shop's opening message and its payment QR codes — how the vendor
 * actually gets paid, since the app never touches money (ADR 0009). Shared
 * by ShopFormPage and the onboarding wizard's payment step.
 */
export function OpeningMessageFields({
  message,
  onMessageChange,
  onPhotosChange,
  existingPhotos,
  addon,
}: OpeningMessageFieldsProps) {
  return (
    <>
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
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            placeholder="e.g. GCash to 0917-xxx-xxxx. Please send proof of payment here."
          />
        </label>
        <label>
          QR codes (JPEG/PNG/WebP, up to 5)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            onChange={(e) => onPhotosChange(e.target.files)}
          />
        </label>
        {existingPhotos && existingPhotos.length > 0 && (
          <div className="thumbs">
            {existingPhotos.map((p) => (
              <img key={p.id} src={`${API_ORIGIN}${p.url}`} alt={p.filename} />
            ))}
          </div>
        )}
      </fieldset>
      {addon}
    </>
  )
}
