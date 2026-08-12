import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api, ApiError } from '../api/client'

// Deliberately minimal — this app has no general user-settings page yet, just
// enough surface for the one SMS notification preference. Shop-level settings
// stay on ShopFormPage; this is account-level (the User, not the Shop).
export function AccountPage() {
  const { user, loading } = useAuth()
  const [checked, setChecked] = useState(false)
  // Guards the one-time sync from the fetched user into local editable state
  // below, the same "derive once, then let the field own it" shape
  // DefaultDeliveryNote (customer-web) uses for its note textarea.
  const [initialized, setInitialized] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user && !initialized) {
      setChecked(user.sms_notify_order_placed)
      setInitialized(true)
    }
  }, [user, initialized])

  if (loading) return <p>Loading…</p>
  if (!user) return <Navigate to="/login" replace />

  async function save() {
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      await api.updateMe({ sms_notify_order_placed: checked })
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your preferences')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1>Account</h1>

      <div className="card">
        <h2>Notifications</h2>
        <label className="row gap">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => {
              setChecked(e.target.checked)
              setSaved(false)
            }}
          />
          Notify me by SMS when I get a new order
        </label>
        <button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        {saved && !error && <span className="muted small" style={{ marginLeft: '0.5rem' }}>Saved.</span>}
        {error && <p role="alert" className="error">{error}</p>}
      </div>
    </div>
  )
}
