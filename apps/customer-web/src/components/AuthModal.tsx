import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ApiError } from '../api/client'

interface Props {
  open: boolean
  onClose: () => void
  // Called once sign-in succeeds, so the caller can resume whatever action
  // (e.g. "add to cart") triggered the prompt in the first place.
  onSuccess: () => void
}

// Sign-in only. Registration is now a 3-screen flow (LoginPage +
// VerifyMobilePage + CompleteProfilePage) that doesn't fit in a modal, so
// this modal sends anyone wanting to create an account to /login instead.
// Note: this component currently has no importer anywhere in the app.
export function AuthModal({ open, onClose, onSuccess }: Props) {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      onSuccess()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <h2>Welcome back</h2>
        <p className="muted">
          Browsing is always free — an account just lets you build a real cart and
          come back to it later.
        </p>
        <form onSubmit={onSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : 'Sign in'}
          </button>
        </form>
        <button className="link" onClick={() => { onClose(); navigate('/login') }}>
          New here? Create an account
        </button>
      </div>
    </div>
  )
}
