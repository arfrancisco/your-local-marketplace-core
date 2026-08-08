import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api, ApiError } from '../api/client'
import type { Address, User } from '../api/types'
import { vendorWebUrl } from '../vendorWeb'

// Shared by the email and mobile verification actions below — same
// request-code/confirm-code shape either way.
function VerificationAction({
  requestCode,
  confirmCode,
  onVerified,
  actionLabel,
}: {
  requestCode: () => Promise<unknown>
  confirmCode: (code: string) => Promise<{ user: User }>
  onVerified: (user: User) => void
  actionLabel: string
}) {
  const [codeSent, setCodeSent] = useState(false)
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send() {
    setError(null)
    setSending(true)
    try {
      await requestCode()
      setCodeSent(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send code')
    } finally {
      setSending(false)
    }
  }

  async function confirm(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setConfirming(true)
    try {
      const res = await confirmCode(code)
      onVerified(res.user)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired code')
    } finally {
      setConfirming(false)
    }
  }

  if (!codeSent) {
    return (
      <div>
        <button className="link" onClick={send} disabled={sending}>
          {sending ? 'Sending…' : actionLabel}
        </button>
        {error && <p role="alert" className="error">{error}</p>}
      </div>
    )
  }

  return (
    <form onSubmit={confirm} className="row gap">
      <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Code" />
      <button type="submit" disabled={confirming || !code}>
        {confirming ? 'Confirming…' : 'Confirm'}
      </button>
      {error && <p role="alert" className="error">{error}</p>}
    </form>
  )
}

function eligibilityReasonLine(reason: string): ReactNode {
  switch (reason) {
    case 'not_resident':
      return 'Vendor accounts are currently limited to residents/tenants of the community.'
    case 'not_willing_to_verify':
      return 'Vendor accounts require willingness to verify residency.'
    case 'email_not_verified':
      return (
        <>
          Verify your email to become eligible. <a href="#email-verify">Verify now</a>
        </>
      )
    default:
      return reason
  }
}

// "Used for every order unless you say otherwise" — a default note attached
// to the customer's default address, editable independent of any one order.
function DefaultDeliveryNote({ defaultAddressId }: { defaultAddressId: number | null }) {
  const [address, setAddress] = useState<Address | null>(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api
      .listAddresses()
      .then((res) => {
        if (cancelled) return
        const match = res.addresses.find((a) => a.id === defaultAddressId) ?? null
        setAddress(match)
        setNote(match?.delivery_instructions ?? '')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [defaultAddressId])

  async function save() {
    if (!address) return
    setError(null)
    setSaved(false)
    setSaving(true)
    try {
      const res = await api.updateAddress(address.id, { delivery_instructions: note })
      setAddress(res.address)
      setSaved(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your delivery note')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return null

  return (
    <div className="card">
      <h2>Default delivery note</h2>
      <p className="muted small">Used for every order unless you say otherwise.</p>
      {address ? (
        <>
          <textarea
            value={note}
            onChange={(e) => {
              setNote(e.target.value)
              setSaved(false)
            }}
            rows={3}
            placeholder="e.g. Leave with the guard, gate code 1234…"
          />
          <button onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {saved && !error && <span className="muted small" style={{ marginLeft: '0.5rem' }}>Saved.</span>}
          {error && <p role="alert" className="error">{error}</p>}
        </>
      ) : (
        <p className="muted small">Set a default address to add a delivery note.</p>
      )}
    </div>
  )
}

export function AccountPage() {
  const { user, loading } = useAuth()
  // Local overrides applied after verification/vendor actions return a fresh
  // user (e.g. from /verifications/email/confirm). Derived, not mirrored via
  // an effect, so there's no render where `user` is populated but this value
  // still lags a tick behind it.
  const [override, setOverride] = useState<User | null>(null)
  const profile = override ?? user
  const [vendorError, setVendorError] = useState<string | null>(null)
  const [startingVendor, setStartingVendor] = useState(false)

  if (loading) return <p>Loading…</p>
  if (!profile) return <Navigate to="/login?return_to=/account" replace />

  async function startSelling() {
    setVendorError(null)
    setStartingVendor(true)
    try {
      await api.becomeVendor()
      // Full navigation, not React Router — crossing from customer-web into
      // vendor-web, a separate SPA sharing the same origin and auth token.
      window.location.href = vendorWebUrl('/onboarding')
    } catch (err) {
      setVendorError(err instanceof ApiError ? err.message : 'Could not start selling')
      setStartingVendor(false)
    }
  }

  const { vendor_eligibility: eligibility } = profile
  const alreadyVendor = eligibility.reasons.includes('already_vendor')

  return (
    <div>
      <h1>My account</h1>

      <div className="card">
        <h2>Profile</h2>
        <p>{[profile.first_name, profile.last_name].filter(Boolean).join(' ') || <span className="muted">Name not set</span>}</p>

        <div className="row spread">
          <span>{profile.email}</span>
          {profile.email_verified ? (
            <span className="badge-verified">Verified</span>
          ) : (
            <span className="badge-unverified">Not verified</span>
          )}
        </div>
        {!profile.email_verified && (
          <div id="email-verify">
            <p className="muted small">Verify your email to enable account recovery.</p>
            <VerificationAction
              actionLabel="Verify your email"
              requestCode={api.requestEmailVerification}
              confirmCode={api.confirmEmailVerification}
              onVerified={setOverride}
            />
          </div>
        )}

        <div className="row spread" style={{ marginTop: '0.75rem' }}>
          <span>{profile.mobile_number ?? <span className="muted">No mobile number</span>}</span>
          {profile.mobile_verified ? (
            <span className="badge-verified">Verified</span>
          ) : (
            <span className="badge-unverified">Not verified</span>
          )}
        </div>
        {!profile.mobile_verified && profile.mobile_number && (
          <div id="mobile-verify">
            <VerificationAction
              actionLabel="Verify your mobile number"
              requestCode={api.requestMobileVerification}
              confirmCode={api.confirmMobileVerification}
              onVerified={setOverride}
            />
          </div>
        )}
      </div>

      <div className="card">
        <h2>Residency</h2>
        <p>Resident/tenant of the community: {profile.customer_profile?.is_resident ? 'Yes' : 'No'}</p>
        {profile.customer_profile?.is_resident && (
          <p>
            Willing to be verified: {profile.customer_profile?.willing_to_verify_residency ? 'Yes' : 'No'}
          </p>
        )}
      </div>

      <DefaultDeliveryNote defaultAddressId={profile.customer_profile?.default_address_id ?? null} />

      <div className="card">
        <h2>Become a vendor</h2>
        {alreadyVendor ? (
          <>
            <p>You're already a vendor.</p>
            {/* Real page navigation, not React Router's Link — this belongs
                to the separate vendor-web SPA, and this app's own catch-all
                route would otherwise swallow client-side nav here and bounce
                straight back to /shops. */}
            <a href={vendorWebUrl('/shops')}>Go to your shop</a>
          </>
        ) : eligibility.eligible ? (
          <>
            <p>You're eligible to start selling.</p>
            <button onClick={startSelling} disabled={startingVendor}>
              {startingVendor ? 'Please wait…' : 'Start selling'}
            </button>
          </>
        ) : (
          <ul className="list">
            {eligibility.reasons.map((reason) => (
              <li key={reason}>{eligibilityReasonLine(reason)}</li>
            ))}
          </ul>
        )}
        {vendorError && <p role="alert" className="error">{vendorError}</p>}
      </div>
    </div>
  )
}
