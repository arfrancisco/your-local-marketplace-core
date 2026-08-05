import termsContent from '../legal/terms-and-conditions.md?raw'
import privacyContent from '../legal/privacy-policy.md?raw'
import { LegalDoc } from './LegalDoc'

// Mirrors customer-web's LegalModal (src/components/LegalModal.tsx). Only
// entry point here is the footer (Footer.tsx) — vendor-web has no
// registration-time Terms checkbox and no standalone /legal pages.

const CONTENT_BY_DOC: Record<'terms' | 'privacy', string> = {
  terms: termsContent,
  privacy: privacyContent,
}

const TITLE_BY_DOC: Record<'terms' | 'privacy', string> = {
  terms: 'Terms and Conditions',
  privacy: 'Privacy Policy',
}

interface Props {
  doc: 'terms' | 'privacy' | null
  onClose: () => void
  onNavigate: (doc: 'terms' | 'privacy') => void
}

export function LegalModal({ doc, onClose, onNavigate }: Props) {
  if (!doc) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal wide" role="dialog" aria-modal="true" aria-label={TITLE_BY_DOC[doc]} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <div className="legal-modal-body">
          <LegalDoc content={CONTENT_BY_DOC[doc]} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  )
}
