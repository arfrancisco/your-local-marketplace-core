import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from './api/client'
import { vendorWebUrl } from './vendorWeb'

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

  async function start() {
    setStarting(true)
    try {
      await api.becomeVendor()
      // Full navigation, not React Router — crossing from customer-web into
      // vendor-web, a separate SPA sharing the same origin and auth token.
      window.location.href = vendorWebUrl('/onboarding')
    } catch {
      // Not actually eligible (e.g. not a resident) despite the banner/menu
      // entry point showing — those don't pre-check full eligibility, only
      // "no vendor_profile yet". /account already has the full explanation
      // of which requirement is unmet, so land there instead of failing
      // silently with nowhere to show an error.
      setStarting(false)
      navigate('/account')
    }
  }

  return { start, starting }
}
