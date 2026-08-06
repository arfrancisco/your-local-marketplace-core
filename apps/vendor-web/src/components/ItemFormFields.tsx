import type { ReactNode } from 'react'
import type { Photo } from '../api/types'

const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1').replace(/\/api\/v1\/?$/, '')

interface ItemFormFieldsProps {
  name: string
  onNameChange: (value: string) => void
  description: string
  onDescriptionChange: (value: string) => void
  price: string
  onPriceChange: (value: string) => void
  tags: string
  onTagsChange: (value: string) => void
  stockCount: string
  onStockCountChange: (value: string) => void
  onFilesChange: (files: FileList | null) => void
  existingPhotos?: Photo[]
  /** Rendered inside the Name field's own `.tour-anchor` wrapper — lets a
   * caller point an opt-in tour callout at this field without this
   * component knowing anything about tours. */
  nameFieldAddon?: ReactNode
}

// The add-item and edit-item modals (ItemsPage) both need this exact set of
// fields — pulled out once so neither has to duplicate the whole form.
export function ItemFormFields({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  price,
  onPriceChange,
  tags,
  onTagsChange,
  stockCount,
  onStockCountChange,
  onFilesChange,
  existingPhotos,
  nameFieldAddon,
}: ItemFormFieldsProps) {
  return (
    <>
      <label className="tour-anchor">
        Name (shown to customers, and matched when they search)
        <input value={name} onChange={(e) => onNameChange(e.target.value)} required />
        {nameFieldAddon}
      </label>
      <label>
        Description (shown on the item — not used for search)
        <textarea value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
      </label>
      <label>
        Price
        <input type="number" step="0.01" min="0.01" value={price} onChange={(e) => onPriceChange(e.target.value)} required />
      </label>
      <label>
        Tags (comma separated — also matched when customers search, e.g. "handmade" or "spicy")
        <input value={tags} onChange={(e) => onTagsChange(e.target.value)} placeholder="bestseller, limited stock" />
      </label>
      <label>
        Stock count (optional — leave blank if you don't track stock)
        <input
          type="number"
          step="1"
          min="0"
          value={stockCount}
          onChange={(e) => onStockCountChange(e.target.value)}
        />
      </label>
      <label>
        Photos (up to 3)
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => onFilesChange(e.target.files)} />
      </label>
      {existingPhotos && existingPhotos.length > 0 && (
        <div className="thumbs">
          {existingPhotos.map((p) => (
            <img key={p.id} src={`${API_ORIGIN}${p.url}`} alt={p.filename} />
          ))}
        </div>
      )}
    </>
  )
}
