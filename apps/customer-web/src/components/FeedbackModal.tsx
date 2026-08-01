import { useState, type FormEvent } from 'react'
import { api, ApiError } from '../api/client'
import { useAuth } from '../auth'

interface Props {
  onClose: () => void
}

// Beta feedback/complaints intake — reachable from the header at all times,
// signed in or not, since browsing itself is public too.
export function FeedbackModal({ onClose }: Props) {
  const { user } = useAuth()
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await api.sendFeedback({ message, email: email.trim() || undefined, page_url: window.location.href })
      setSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Send feedback" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        {sent ? (
          <div className="modal-done">
            <h2>Thanks!</h2>
            <p className="muted">We read every message during the beta. Appreciate you flagging it.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <h2>Send feedback</h2>
            <p className="muted">Found a bug, or something feels off? Tell us here.</p>
            <label>
              What's going on?
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
              />
            </label>
            {!user && (
              <label>
                Email (optional, if you'd like a reply)
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </label>
            )}
            {error && <p role="alert" className="error">{error}</p>}
            <button type="submit" disabled={submitting || !message.trim()}>
              {submitting ? 'Sending…' : 'Send feedback'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
