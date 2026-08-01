import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../api/client'

// Email is carried over via route state from ForgotPasswordPage, but stays
// editable here too in case someone reloads or lands on this page directly.
export function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const carriedEmail = (location.state as { email?: string } | null)?.email ?? ''

  const [email, setEmail] = useState(carriedEmail)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }
    setSubmitting(true)
    try {
      await api.confirmPasswordReset(email, code, newPassword)
      navigate('/login', { state: { message: 'Password reset. Please sign in.' } })
    } catch (err) {
      // Same generic message whether the email is unknown or the code is
      // wrong — never differentiate (matches the backend's anti-enumeration
      // behavior for this endpoint).
      setError(err instanceof ApiError ? err.message : 'Invalid or expired code')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card narrow">
      <h1>Reset your password</h1>
      <form onSubmit={onSubmit}>
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label>
          Reset code
          <input value={code} onChange={(e) => setCode(e.target.value)} required />
        </label>
        <label>
          New password
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
        </label>
        <label>
          Confirm new password
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : 'Reset password'}
        </button>
      </form>
    </div>
  )
}
