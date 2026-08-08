import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from './api/client'
import { vendorWebUrl } from './vendorWeb'

// Matches Vendors::Upgrade's reason codes (apps/api/app/services/vendors/upgrade.rb).
export const EMAIL_NOT_VERIFIED_REASON = 'email_not_verified'

// Shared by the header banner and hamburger menu's "become a vendor" entry
// points so a click from either does the actual upgrade immediately, rather
// than just linking to /account and leaving a second, easy-to-miss click
// required there — that two-step version read as a broken link to more than
// one user. AccountPage's own "Start selling" button keeps its own inline
// version of this (it wants a persistent error message on the page, which
// these two drive-by entry points have nowhere good to show), gated behind
// the fuller eligibility check it already displays.
export function useBecomeVendor() {
  const navigate = useNavigate()
  const [starting, setStarting] = useState(false)
  const [showEmailVerifyModal, setShowEmailVerifyModal] = useState(false)

  async function start() {
    setStarting(true)
    try {
      await api.becomeVendor()
      // Full navigation, not React Router — crossing from customer-web into
      // vendor-web, a separate SPA sharing the same origin and auth token.
      window.location.href = vendorWebUrl('/onboarding')
    } catch (err) {
      setStarting(false)
      // Vendors::Upgrade returns the specific unmet reasons in details.reasons
      // (see apps/api/app/services/vendors/upgrade.rb). When email
      // verification is the *only* thing blocking — the realistic default
      // state for every new registrant now that mobile is verified at
      // registration instead — that's a single quick fix-in-place action, so
      // surface it right here instead of bouncing to /account. Any other or
      // multiple reasons (not a resident, already a vendor, etc.) aren't a
      // one-click fix, so those keep the old behavior: land on /account,
      // which already has the full explanation of what's unmet.
      const reasons = err instanceof ApiError ? (err.details?.reasons as string[] | undefined) : undefined
      if (reasons?.length === 1 && reasons[0] === EMAIL_NOT_VERIFIED_REASON) {
        setShowEmailVerifyModal(true)
        return
      }
      navigate('/account')
    }
  }

  return { start, starting, showEmailVerifyModal, closeEmailVerifyModal: () => setShowEmailVerifyModal(false) }
}
