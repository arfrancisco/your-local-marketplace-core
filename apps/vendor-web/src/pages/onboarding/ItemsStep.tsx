import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../../api/client'
import { ItemFormFields } from '../../components/ItemFormFields'
import { colorFor, emojiFor } from '../../visuals'
import { OnboardingStepShell, useOnboarding } from './OnboardingLayout'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

function formatPrice(cents: number, currency: string) {
  return `${currency} ${(cents / 100).toFixed(2)}`
}

// Step 3 — reads inventory live rather than assuming this is the vendor's
// first ever item: the bottom tab bar stays visible during onboarding, so
// they may well have added items from the Inventory tab already.
export function ItemsStep() {
  const { shop, items, itemsLoading, addItem, saveAndAdvance } = useOnboarding()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [tags, setTags] = useState('')
  const [stockCount, setStockCount] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [addError, setAddError] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const hasItems = items.length > 0

  async function onAddItem(e: FormEvent) {
    e.preventDefault()
    if (!shop) return
    setAddError(null)
    setAdding(true)
    const fd = new FormData()
    fd.append('item[name]', name)
    fd.append('item[description]', description)
    fd.append('item[price_cents]', String(Math.round(parseFloat(price || '0') * 100)))
    tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => fd.append('item[tags][]', t))
    // Left out entirely when blank so the server keeps stock_count null
    // (untracked) instead of treating the item as sold out.
    if (stockCount.trim() !== '') fd.append('item[stock_count]', stockCount.trim())
    if (files) Array.from(files).forEach((f) => fd.append('item[photos][]', f))

    try {
      const res = await api.createItem(shop.id, fd)
      addItem(res.item)
      setName('')
      setDescription('')
      setPrice('')
      setTags('')
      setStockCount('')
      setFiles(null)
    } catch (err) {
      setAddError(err instanceof ApiError ? err.message : 'Could not add item')
    } finally {
      setAdding(false)
    }
  }

  async function advance() {
    setError(null)
    setSaving(true)
    try {
      await saveAndAdvance('payment')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your progress')
    } finally {
      setSaving(false)
    }
  }

  return (
    <OnboardingStepShell
      step="items"
      heading={hasItems ? 'Add another item' : 'Add your first item'}
      intro="One is enough to open. You can add the rest from Inventory whenever you're ready."
      error={error}
      actions={
        // One action, not two: items are saved individually by "Add item"
        // above, so Continue and Skip would do the identical thing here and
        // differ only in label. The label follows what the vendor has
        // actually done instead.
        <button type="button" disabled={saving} onClick={advance}>
          {saving ? 'Saving…' : hasItems ? 'Continue' : 'Skip for now'}
        </button>
      }
    >
      {itemsLoading && <p className="muted">Loading your items…</p>}
      {hasItems && (
        <div className="onboarding-items-so-far">
          <p className="muted small">Added so far</p>
          <ul className="list">
            {items.map((item) => (
              <li key={item.id} className="card row spread item-row">
                <div className="item-main">
                  {item.photos[0] ? (
                    <img className="thumb" src={`${API_ORIGIN}${item.photos[0].url}`} alt={item.name} />
                  ) : (
                    <div className="thumb tile" style={{ background: colorFor(item.name) }} aria-hidden>
                      {emojiFor(`${item.name} ${item.tags.map((t) => t.name).join(' ')}`)}
                    </div>
                  )}
                  <div>
                    <h3>{item.name}</h3>
                  </div>
                </div>
                <div className="price-col">
                  <strong>{formatPrice(item.price_cents, item.currency)}</strong>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={onAddItem}>
        <ItemFormFields
          name={name}
          onNameChange={setName}
          description={description}
          onDescriptionChange={setDescription}
          price={price}
          onPriceChange={setPrice}
          tags={tags}
          onTagsChange={setTags}
          stockCount={stockCount}
          onStockCountChange={setStockCount}
          onFilesChange={setFiles}
        />
        {addError && <p role="alert" className="error">{addError}</p>}
        <button type="submit" className="button" disabled={adding}>
          {adding ? 'Adding…' : hasItems ? 'Add another' : 'Add item'}
        </button>
      </form>
    </OnboardingStepShell>
  )
}
