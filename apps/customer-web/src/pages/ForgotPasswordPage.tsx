import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'

// Always shows the same generic outcome regardless of whether the email is
// on file — anti-enumeration, per the backend's own /password_resets
// contract (always 202, same message).
export function ForgotPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const carriedEmail = (location.state as { email?: string } | null)?.email ?? ''

  const [email, setEmail] = useState(carriedEmail)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.requestPasswordReset(email)
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <div className="card narrow">
        <h1>Check your messages</h1>
        <p>If an account exists with that email, we've sent a reset code.</p>
        <button className="plain-link" onClick={() => navigate('/reset-password', { state: { email } })}>
          I have my code
        </button>
      </div>
    )
  }

  return (
    <div className="card narrow">
      <h1>Forgot your password?</h1>
      <p className="muted">We'll send a reset code to your email if an account exists for it.</p>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Send reset code'}
        </button>
      </form>
    </div>
  )
}
