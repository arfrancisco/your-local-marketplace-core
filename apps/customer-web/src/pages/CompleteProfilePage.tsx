import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'

interface Props {
  // Whether this account answered "yes" to the residency question on screen
  // 1 — the backend only requires `unit` for residents, so we mirror that
  // client-side rather than always requiring it.
  isResident: boolean
  onDone: () => void
}

// Screen 3 of registration. Not skippable — there is no way past this screen
// other than a successful submit.
export function CompleteProfilePage({ isResident, onDone }: Props) {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [building, setBuilding] = useState('')
  const [unit, setUnit] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (isResident && !unit.trim()) {
      setError('Unit number is required for residents.')
      return
    }
    setSubmitting(true)
    try {
      await api.completeProfile({
        first_name: firstName,
        last_name: lastName,
        address: {
          building,
          unit: unit.trim() || undefined,
          street_address: streetAddress.trim() || undefined,
          city: city.trim() || undefined,
        },
      })
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <h1>Tell us about you</h1>
      <form onSubmit={onSubmit}>
        <label>
          First name
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </label>
        <label>
          Last name
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </label>
        <label>
          Tower
          <input value={building} onChange={(e) => setBuilding(e.target.value)} required />
        </label>
        <label>
          Unit number{isResident ? '' : ' (optional)'}
          <input value={unit} onChange={(e) => setUnit(e.target.value)} required={isResident} />
        </label>
        <label>
          Street address (optional)
          <input value={streetAddress} onChange={(e) => setStreetAddress(e.target.value)} />
        </label>
        <label>
          City (optional)
          <input value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : 'Finish'}
        </button>
      </form>
    </div>
  )
}
