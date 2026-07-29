import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../api/client'
import type { FulfillmentMethod, Shop } from '../api/types'

const METHODS: FulfillmentMethod[] = ['pickup', 'delivery']

export function ShopFormPage() {
  const { id } = useParams()
  const editing = Boolean(id)
  const navigate = useNavigate()

  const [shop, setShop] = useState<Shop | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [address, setAddress] = useState('')
  const [contact, setContact] = useState('')
  const [methods, setMethods] = useState<FulfillmentMethod[]>(['pickup'])
  const [files, setFiles] = useState<FileList | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!editing) return
    api.getShop(Number(id)).then((res) => {
      const s = res.shop
      setShop(s)
      setName(s.name)
      setDescription(s.description ?? '')
      setAddress(s.address ?? '')
      setContact(s.contact_number ?? '')
      setMethods(s.fulfillment_methods)
    })
  }, [id, editing])

  function toggleMethod(method: FulfillmentMethod) {
    setMethods((prev) => (prev.includes(method) ? prev.filter((m) => m !== method) : [...prev, method]))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const fd = new FormData()
    fd.append('shop[name]', name)
    fd.append('shop[description]', description)
    fd.append('shop[address]', address)
    fd.append('shop[contact_number]', contact)
    methods.forEach((m) => fd.append('shop[fulfillment_methods][]', m))
    if (files) Array.from(files).forEach((f) => fd.append('shop[photos][]', f))

    try {
      if (editing) await api.updateShop(Number(id), fd)
      else await api.createShop(fd)
      navigate('/shops')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save shop')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card narrow">
      <h1>{editing ? 'Edit shop' : 'New shop'}</h1>
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
          Address (unit / building)
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>
        <label>
          Contact number
          <input value={contact} onChange={(e) => setContact(e.target.value)} />
        </label>

        <fieldset>
          <legend>Fulfillment</legend>
          {METHODS.map((m) => (
            <label key={m} className="inline">
              <input type="checkbox" checked={methods.includes(m)} onChange={() => toggleMethod(m)} />
              {m}
            </label>
          ))}
        </fieldset>

        <label>
          Photos (JPEG/PNG/WebP, up to 3)
          <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setFiles(e.target.files)} />
        </label>

        {shop && shop.photos.length > 0 && (
          <div className="thumbs">
            {shop.photos.map((p) => (
              <img key={p.id} src={`http://localhost:3000${p.url}`} alt={p.filename} />
            ))}
          </div>
        )}

        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save shop'}</button>
      </form>
    </div>
  )
}
