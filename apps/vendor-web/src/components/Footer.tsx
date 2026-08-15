import { useState } from 'react'
import { LegalModal } from './LegalModal'
import { FeedbackModal } from './FeedbackModal'

// Persistent footer (App.tsx, rendered on every route) so vendors can review
// Terms/Privacy any time, not just at signup. Owns its own open/close state,
// independent of any page. Feedback lives here too now, moved from the
// retired hamburger drawer — same move customer-web's Footer.tsx already
// made, same FeedbackModal.
export function Footer() {
  const [legalModalOpen, setLegalModalOpen] = useState<'terms' | 'privacy' | null>(null)
  const [feedbackOpen, setFeedbackOpen] = useState(false)

  return (
    <footer className="app-footer">
      <button type="button" className="inline-link" onClick={() => setLegalModalOpen('terms')}>
        Terms and Conditions
      </button>
      <span aria-hidden="true"> · </span>
      <button type="button" className="inline-link" onClick={() => setLegalModalOpen('privacy')}>
        Privacy Policy
      </button>
      <span aria-hidden="true"> · </span>
      <button type="button" className="inline-link" onClick={() => setFeedbackOpen(true)}>
        Send feedback
      </button>
      <LegalModal doc={legalModalOpen} onClose={() => setLegalModalOpen(null)} onNavigate={setLegalModalOpen} />
      {feedbackOpen && <FeedbackModal onClose={() => setFeedbackOpen(false)} />}
    </footer>
  )
}
