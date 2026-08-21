import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { ShopPhotoFields, type PhotoField } from '../../components/ShopPhotoFields'
import { OnboardingStepShell, useOnboarding } from './OnboardingLayout'

// Step 2 — optional. Photos already on the shop show up as "Current …" via
// ShopPhotoFields, so a vendor coming back here sees what they have rather
// than an empty-looking form.
export function PhotosStep() {
  const { shop, updateDraft, saveAndAdvance } = useOnboarding()
  const [profilePhotoFile, setProfilePhotoFile] = useState<File | null>(null)
  const [coverPhotoFile, setCoverPhotoFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  function onPhotoChange(field: PhotoField, file: File, previewUrl: string) {
    if (field === 'profile_photo') {
      setProfilePhotoFile(file)
      updateDraft({ profilePreviewUrl: previewUrl })
    } else {
      setCoverPhotoFile(file)
      updateDraft({ coverPreviewUrl: previewUrl })
    }
  }

  async function advance(withPhotos: boolean) {
    setError(null)
    setSaving(true)
    const fd = new FormData()
    let hasNewPhotos = false
    if (withPhotos) {
      if (profilePhotoFile) {
        fd.append('shop[profile_photo]', profilePhotoFile)
        hasNewPhotos = true
      }
      if (coverPhotoFile) {
        fd.append('shop[cover_photo]', coverPhotoFile)
        hasNewPhotos = true
      }
    }
    try {
      // Continuing without picking anything is the same request as
      // skipping: there is nothing to upload either way.
      await saveAndAdvance('items', hasNewPhotos ? fd : undefined)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your photos')
    } finally {
      setSaving(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    void advance(true)
  }

  const hasPhotos = Boolean(shop?.profile_photo || shop?.cover_photo)

  return (
    <form onSubmit={onSubmit}>
      <OnboardingStepShell
        step="photos"
        heading={hasPhotos ? 'Your shop photos' : 'Add your shop photos'}
        intro={
          hasPhotos
            ? "Here's what you've uploaded so far. Replace either one, or move on."
            : "Shops with a real photo get opened more often. Skip it and we'll show a coloured tile until you add one."
        }
        error={error}
        actions={
          <>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving…' : 'Continue'}
            </button>
            <button type="button" className="button" disabled={saving} onClick={() => advance(false)}>
              Skip for now
            </button>
          </>
        }
      >
        <ShopPhotoFields
          profilePhoto={shop?.profile_photo}
          coverPhoto={shop?.cover_photo}
          onPhotoChange={onPhotoChange}
        />
      </OnboardingStepShell>
    </form>
  )
}
