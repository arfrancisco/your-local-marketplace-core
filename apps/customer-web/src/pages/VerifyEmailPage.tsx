import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'

interface Props {
  onDone: () => void
}

// Screen 2 of registration. Not skippable, unlike the mobile-verification
// screen it temporarily replaces (see LoginPage's SKIP_MOBILE_VERIFICATION
// comment) — email delivery is the channel that's actually reliable right
// now, so this is the one verification step required to finish signing up.
export function VerifyEmailPage({ onDone }: Props) {
  const [code, setCode] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Fires the first email automatically on arriving at this screen. In
  // practice a code was already sent at registration (Auth::RegisterUser
  // issues one as a side effect), so this is effectively a resend — cheap
  // and harmless, and it means "Resend code" always has a fresh code to
  // fall back on even if the very first one never arrived.
  useEffect(() => {
    api.requestEmailVerification().catch(() => {
      // Swallow: the user can still hit "Resend code" if this silently failed.
    })
  }, [])

  async function resend() {
    setError(null)
    setInfo(null)
    setSending(true)
    try {
      await api.requestEmailVerification()
      setInfo('Code sent. Check your inbox.')
    } catch (err) {
      if (err instanceof ApiError && err.code === 'rate_limited') {
        const retryAfter = err.details?.retry_after
        setError(typeof retryAfter === 'number' ? `Try again in ${retryAfter}s` : 'Please wait before requesting another code.')
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not resend code')
      }
    } finally {
      setSending(false)
    }
  }

  async function onConfirm(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setConfirming(true)
    try {
      await api.confirmEmailVerification(code)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired code')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div>
      <h1>Verify your email</h1>
      <p className="muted">We emailed you a code. Enter it below to continue.</p>
      <form onSubmit={onConfirm}>
        <label>
          Verification code
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            autoComplete="one-time-code"
            required
          />
        </label>
        {error && <p role="alert" className="error">{error}</p>}
        {info && <p className="muted small">{info}</p>}
        <button type="submit" disabled={confirming || !code}>
          {confirming ? 'Confirming…' : 'Confirm'}
        </button>
      </form>
      <button className="plain-link" onClick={resend} disabled={sending}>
        {sending ? 'Sending…' : 'Resend code'}
      </button>
    </div>
  )
}
