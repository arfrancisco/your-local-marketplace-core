import { useState } from 'react'
import { LegalModal } from './LegalModal'

// Persistent footer (App.tsx, rendered on every route) so vendors can review
// Terms/Privacy any time, not just at signup. Owns its own open/close state,
// independent of any page.
export function Footer() {
  const [legalModalOpen, setLegalModalOpen] = useState<'terms' | 'privacy' | null>(null)

  return (
    <footer className="app-footer">
      <button type="button" className="inline-link" onClick={() => setLegalModalOpen('terms')}>
        Terms and Conditions
      </button>
      <span aria-hidden="true"> · </span>
      <button type="button" className="inline-link" onClick={() => setLegalModalOpen('privacy')}>
        Privacy Policy
      </button>
      <LegalModal doc={legalModalOpen} onClose={() => setLegalModalOpen(null)} onNavigate={setLegalModalOpen} />
    </footer>
  )
}
