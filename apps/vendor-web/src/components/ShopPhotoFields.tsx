import { useEffect, useState, type ChangeEvent, type ReactNode } from 'react'
import type { Photo } from '../api/types'
import { ImageCropModal } from './ImageCropModal'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

// Facebook's own conventions: a square identity thumbnail and a wide banner.
// Both are cropped client-side to these exact ratios before upload, so the
// customer-side list card and shop-detail hero never have to letterbox.
export type PhotoField = 'profile_photo' | 'cover_photo'

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

interface ShopPhotoFieldsProps {
  /** Already-saved photos, shown until a new crop replaces them. */
  profilePhoto?: Photo | null
  coverPhoto?: Photo | null
  /**
   * Fires once a crop is confirmed, with the cropped file ready for
   * FormData and the object URL this component created to preview it (the
   * onboarding wizard feeds that URL into its live shop preview).
   */
  onPhotoChange: (field: PhotoField, file: File, previewUrl: string) => void
  /** Rendered inside the fieldset's own `.tour-anchor` wrapper. */
  addon?: ReactNode
}

/**
 * The shop's profile picture and cover photo, with the crop-on-upload flow
 * (ImageCropModal) in front of both. Shared by ShopFormPage and the
 * onboarding wizard's photos step; the raw file the vendor picked never
 * leaves the crop dialog, only the cropped export does.
 */
export function ShopPhotoFields({ profilePhoto, coverPhoto, onPhotoChange, addon }: ShopPhotoFieldsProps) {
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  // The file waiting to be cropped, and which field it belongs to. Non-null
  // means the crop dialog is open.
  const [cropping, setCropping] = useState<{ field: PhotoField; file: File } | null>(null)

  // Object URLs for the cropped previews, revoked when replaced or on unmount.
  useEffect(() => () => {
    if (profilePreview) URL.revokeObjectURL(profilePreview)
  }, [profilePreview])
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview)
  }, [coverPreview])

  function pickPhoto(field: PhotoField, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    // Clear the input so cancelling the crop and re-picking the same file
    // still fires a change event.
    e.target.value = ''
    if (file) setCropping({ field, file })
  }

  function onCropConfirmed(cropped: File) {
    if (!cropping) return
    const url = URL.createObjectURL(cropped)
    if (cropping.field === 'profile_photo') setProfilePreview(url)
    else setCoverPreview(url)
    onPhotoChange(cropping.field, cropped, url)
    setCropping(null)
  }

  return (
    <>
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
          profilePhoto && (
            <div className="photo-preview-row">
              <img
                className="photo-preview square"
                src={`${API_ORIGIN}${profilePhoto.url}`}
                alt={profilePhoto.filename}
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
          coverPhoto && (
            <div className="photo-preview-row">
              <img
                className="photo-preview wide"
                src={`${API_ORIGIN}${coverPhoto.url}`}
                alt={coverPhoto.filename}
              />
              <p className="muted">Current cover photo.</p>
            </div>
          )
        )}
      </fieldset>
      {addon}

      {/* A fixed-position overlay renders the same wherever it sits in the
          tree, so it travels with this group even when the group is inside
          a <form>. Every control in ImageCropModal is type="button", so
          nothing in it can submit that form by accident. */}
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
    </>
  )
}
