import { VerifyEmailPage } from '../pages/VerifyEmailPage'

interface Props {
  onClose: () => void
  onVerified: () => void
}

// Shown by useBecomeVendor when email verification is the only thing
// blocking a "become a vendor" attempt — reuses VerifyEmailPage as-is
// (the same screen registration used to use for its own step 2) rather
// than the small inline VerificationAction widget on AccountPage, so the
// fix is immediate and obvious right where the click happened instead of
// a bounce to /account and a scroll to find it.
export function BecomeVendorEmailModal({ onClose, onVerified }: Props) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Verify your email" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>×</button>
        <p className="muted small">Verifying your email is the last thing needed to become a vendor.</p>
        <VerifyEmailPage onDone={onVerified} />
      </div>
    </div>
  )
}
