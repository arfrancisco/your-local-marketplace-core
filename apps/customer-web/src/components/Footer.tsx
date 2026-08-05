import { useState } from 'react'
import { LegalModal } from './LegalModal'
import { FeedbackModal } from './FeedbackModal'

// Persistent footer (App.tsx, rendered inside .container on every route) so
// Terms/Privacy stay reachable after signup, not just from the registration
// checkbox. Same LegalModal, with its own local open/close state — this is
// a second, independent entry point into it. Feedback lives here too —
// FeedbackModal already supports anonymous submissions, and this is the one
// place logged-out visitors can still reach it now that the header replaces
// the hamburger (which used to hold it) with a sign-in/sign-up CTA for them.
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
