import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ApiError } from '../api/client'

export function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'register') await register(email, password, displayName)
      else await login(email, password)
      navigate('/shops')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="card narrow">
      <h1>{mode === 'register' ? 'Create your account' : 'Welcome back'}</h1>
      <form onSubmit={onSubmit}>
        {mode === 'register' && (
          <label>
            Display name
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
          {submitting ? 'Please wait…' : mode === 'register' ? 'Sign up' : 'Sign in'}
        </button>
      </form>
      <button
        className="link"
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
      >
        {mode === 'login' ? 'New here? Create an account' : 'Already have an account? Sign in'}
      </button>
    </div>
  )
}
