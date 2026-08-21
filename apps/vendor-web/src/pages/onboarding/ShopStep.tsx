import { useState, type FormEvent } from 'react'
import { ApiError } from '../../api/client'
import { appendShopBasics, ShopBasicsFields } from '../../components/ShopBasicsFields'
import { OnboardingStepShell, useOnboarding } from './OnboardingLayout'

// Step 1 — the only step that creates the shop. Everything after this
// PATCHes it (see OnboardingLayout's saveAndAdvance).
export function ShopStep() {
  const { shop, draft, updateDraft, saveAndAdvance } = useOnboarding()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData()
    appendShopBasics(fd, draft.basics)
    try {
      await saveAndAdvance('photos', fd)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your shop')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={onSubmit}>
      <OnboardingStepShell
        step="shop"
        heading="Tell us about your shop"
        intro="This is what neighbors see when they browse. You can change any of it later."
        error={error}
        actions={
          <button type="submit" disabled={saving}>
            {saving ? 'Saving…' : 'Continue'}
          </button>
        }
        footnote={
          shop
            ? 'Your shop stays private until you open it.'
            : 'Your shop stays private until you finish setup.'
        }
      >
        <ShopBasicsFields
          values={draft.basics}
          onChange={(patch) => updateDraft({ basics: { ...draft.basics, ...patch } })}
        />
      </OnboardingStepShell>
    </form>
  )
}
