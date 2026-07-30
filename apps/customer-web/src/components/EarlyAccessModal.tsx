import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'

interface Props {
  open: boolean
  onClose: () => void
  // What the person was looking at when they hit the CTA (e.g. an item name),
  // captured as lead context so we know what drew them in.
  context?: string
}

export function EarlyAccessModal({ open, onClose, context }: Props) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [interest, setInterest] = useState('buyer')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  if (!open) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!email.trim() && !mobile.trim()) {
      setError('Enter an email or a mobile number so we can reach you.')
      return
    }
    setSubmitting(true)
    try {
      await api.earlyAccess({ name, email, mobile_number: mobile, interest, context })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function close() {
    // Reset for next time.
    setDone(false)
    setError(null)
    onClose()
  }

  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={close}>×</button>

        {done ? (
          <div className="modal-done">
            <h2>You're on the list 🎉</h2>
            <p className="muted">
              Thanks! Ordering isn't open yet — we'll message you the moment your community goes live.
            </p>
            <button onClick={close}>Done</button>
          </div>
        ) : (
          <>
            <h2>Ordering is coming soon</h2>
            <p className="muted">
              We're just getting started in your building. Join early access and we'll invite you first.
            </p>
            <form onSubmit={onSubmit}>
              <label>
                Name
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Optional" />
              </label>
              <label>
                Email
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
              </label>
              <label>
                Mobile number
                <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="+63 9XX XXX XXXX" />
              </label>
              <fieldset className="interest">
                <legend>I'm interested in</legend>
                {[
                  ['buyer', 'Buying'],
                  ['seller', 'Selling'],
                  ['both', 'Both'],
                ].map(([value, label]) => (
                  <label key={value} className="inline">
                    <input type="radio" name="interest" checked={interest === value} onChange={() => setInterest(value)} />
                    {label}
                  </label>
                ))}
              </fieldset>
              {error && <p role="alert" className="error">{error}</p>}
              <button type="submit" disabled={submitting}>
                {submitting ? 'Joining…' : 'Join early access'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
