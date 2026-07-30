import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth'
import { ApiError } from '../api/client'

interface Props {
  open: boolean
  onClose: () => void
  // Called once sign-in/sign-up succeeds, so the caller can resume whatever
  // action (e.g. "add to cart") triggered the prompt in the first place.
  onSuccess: () => void
}

export function AuthModal({ open, onClose, onSuccess }: Props) {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('register')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'register') await register(email, password, displayName)
      else await login(email, password)
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
        <h2>{mode === 'register' ? 'Quick account to start your cart' : 'Welcome back'}</h2>
        <p className="muted">
          Browsing is always free — an account just lets you build a real cart and
          come back to it later.
        </p>
        <form onSubmit={onSubmit}>
          {mode === 'register' && (
            <label>
              Name
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </label>
          {error && <p role="alert" className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <button className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}>
          {mode === 'login' ? "New here? Create an account" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
