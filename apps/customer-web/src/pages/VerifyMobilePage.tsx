import { useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'

interface Props {
  onDone: () => void
}

// Screen 2 of registration. Not skippable — mobile verification unlocks
// checkout, so there's no path past this screen without it.
export function VerifyMobilePage({ onDone }: Props) {
  const [code, setCode] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  // Fires the first SMS automatically on arriving at this screen — no button
  // needed to trigger the initial send.
  useEffect(() => {
    api.requestMobileVerification().catch(() => {
      // Swallow: the user can still hit "Resend code" if this silently failed.
    })
  }, [])

  async function resend() {
    setError(null)
    setInfo(null)
    setSending(true)
    try {
      await api.requestMobileVerification()
      setInfo('Code sent. Check your messages.')
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
      await api.confirmMobileVerification(code)
      onDone()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired code')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div>
      <h1>Verify your mobile number</h1>
      <p className="muted">We texted you a code. Enter it below to continue.</p>
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
