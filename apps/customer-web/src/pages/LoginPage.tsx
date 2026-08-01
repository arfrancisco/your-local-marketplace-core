import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../auth'
import { ApiError } from '../api/client'
import { SignupProgress } from '../components/SignupProgress'
import { LegalModal } from '../components/LegalModal'
import { VerifyMobilePage } from './VerifyMobilePage'
import { CompleteProfilePage } from './CompleteProfilePage'

// Browsing stays fully public — this page only exists for the moment
// someone wants a real cart, which needs a real account (see auth.tsx).
export function LoginPage() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [params] = useSearchParams()
  const returnTo = params.get('return_to') ?? '/shops'
  const successMessage = (location.state as { message?: string } | null)?.message ?? null

  const [mode, setMode] = useState<'login' | 'register'>(params.get('mode') === 'register' ? 'register' : 'login')
  const [registerStep, setRegisterStep] = useState<1 | 2 | 3>(1)

  // Login fields
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginSubmitting, setLoginSubmitting] = useState(false)

  // Screen 1 (register) fields
  const [email, setEmail] = useState('')
  const [mobileNumber, setMobileNumber] = useState('')
  const [password, setPassword] = useState('')
  const [isResident, setIsResident] = useState<boolean | null>(null)
  const [willingToVerify, setWillingToVerify] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [emailMarketingOptIn, setEmailMarketingOptIn] = useState(false)
  const [smsMarketingOptIn, setSmsMarketingOptIn] = useState(false)
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [emailTaken, setEmailTaken] = useState(false)
  const [registerSubmitting, setRegisterSubmitting] = useState(false)
  const [legalModalOpen, setLegalModalOpen] = useState<'terms' | 'privacy' | null>(null)

  async function onLoginSubmit(e: FormEvent) {
    e.preventDefault()
    setLoginError(null)
    setLoginSubmitting(true)
    try {
      await login(loginEmail, loginPassword)
      navigate(returnTo)
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : 'Could not sign in')
    } finally {
      setLoginSubmitting(false)
    }
  }

  async function onRegisterSubmit(e: FormEvent) {
    e.preventDefault()
    setRegisterError(null)
    setEmailTaken(false)

    if (isResident === null) {
      setRegisterError('Please tell us whether you are a resident or tenant.')
      return
    }
    if (isResident && !willingToVerify) {
      setRegisterError("Please agree to verification, or change your answer to 'No'.")
      return
    }
    if (!termsAccepted) {
      setRegisterError('Please agree to the Terms and Conditions and Privacy Policy to continue.')
      return
    }

    setRegisterSubmitting(true)
    try {
      await register({
        email,
        mobile_number: mobileNumber,
        password,
        is_resident: isResident,
        ...(isResident ? { willing_to_verify_residency: willingToVerify } : {}),
        terms_accepted: termsAccepted,
        email_marketing_opt_in: emailMarketingOptIn,
        sms_marketing_opt_in: smsMarketingOptIn,
      })
      setRegisterStep(2)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'email_taken') {
        setEmailTaken(true)
      } else {
        setRegisterError(err instanceof ApiError ? err.message : 'Could not create account')
      }
    } finally {
      setRegisterSubmitting(false)
    }
  }

  function switchToLogin() {
    setMode('login')
    setEmailTaken(false)
    setRegisterError(null)
    setLoginEmail(email)
  }

  if (mode === 'register' && registerStep === 2) {
    return (
      <div className="card narrow">
        <SignupProgress step={2} />
        <VerifyMobilePage onDone={() => setRegisterStep(3)} />
      </div>
    )
  }

  if (mode === 'register' && registerStep === 3) {
    return (
      <div className="card narrow">
        <SignupProgress step={3} />
        <CompleteProfilePage isResident={!!isResident} onDone={() => navigate(returnTo)} />
      </div>
    )
  }

  return (
    <div className="card narrow">
      {successMessage && <p className="muted">{successMessage}</p>}
      <h1>{mode === 'login' ? 'Sign in' : 'Create an account'}</h1>
      {mode === 'register' && <SignupProgress step={1} />}

      {mode === 'login' ? (
        <form onSubmit={onLoginSubmit}>
          <label>
            Email
            <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
          </label>
          {loginError && <p role="alert" className="error">{loginError}</p>}
          <button type="submit" disabled={loginSubmitting}>
            {loginSubmitting ? 'Please wait…' : 'Sign in'}
          </button>
        </form>
      ) : (
        <form onSubmit={onRegisterSubmit}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Mobile number
            <input
              type="tel"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value)}
              placeholder="09XXXXXXXXX"
              required
            />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </label>

          <fieldset className="interest">
            <legend>Are you currently a resident or tenant of Prisma Residences?</legend>
            <label className="inline">
              <input
                type="radio"
                name="is_resident"
                checked={isResident === true}
                onChange={() => setIsResident(true)}
              />
              Yes
            </label>
            <label className="inline">
              <input
                type="radio"
                name="is_resident"
                checked={isResident === false}
                onChange={() => { setIsResident(false); setWillingToVerify(false) }}
              />
              No
            </label>
          </fieldset>

          {isResident === true && (
            <label className="inline">
              <input
                type="checkbox"
                checked={willingToVerify}
                onChange={(e) => setWillingToVerify(e.target.checked)}
              />
              I'm willing to be verified as a resident/tenant if asked.
            </label>
          )}

          <label className="inline">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
            I agree to the{' '}
            <button type="button" className="inline-link" onClick={() => setLegalModalOpen('terms')}>
              Terms and Conditions
            </button>{' '}
            and{' '}
            <button type="button" className="inline-link" onClick={() => setLegalModalOpen('privacy')}>
              Privacy Policy
            </button>
          </label>

          <div className="marketing-opt-ins">
            <label className="inline">
              <input
                type="checkbox"
                checked={emailMarketingOptIn}
                onChange={(e) => setEmailMarketingOptIn(e.target.checked)}
              />
              Email me about updates and offers
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={smsMarketingOptIn}
                onChange={(e) => setSmsMarketingOptIn(e.target.checked)}
              />
              Text me about updates and offers
            </label>
          </div>

          {emailTaken && (
            <div className="card" style={{ background: '#fef3c7' }}>
              <p>An account with this email already exists.</p>
              <div className="row gap">
                <button type="button" className="link" onClick={switchToLogin}>Sign in instead</button>
                <button
                  type="button"
                  className="link"
                  onClick={() => navigate('/forgot-password', { state: { email } })}
                >
                  Forgot your password?
                </button>
              </div>
            </div>
          )}
          {registerError && <p role="alert" className="error">{registerError}</p>}

          <button type="submit" disabled={registerSubmitting}>
            {registerSubmitting ? 'Please wait…' : 'Create account'}
          </button>
        </form>
      )}

      {mode === 'login' && (
        <button className="plain-link" onClick={() => navigate('/forgot-password')}>
          Forgot your password?
        </button>
      )}
      <button
        className="plain-link"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login')
          setLoginError(null)
          setRegisterError(null)
          setEmailTaken(false)
        }}
      >
        {mode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}
      </button>

      <LegalModal doc={legalModalOpen} onClose={() => setLegalModalOpen(null)} onNavigate={setLegalModalOpen} />
    </div>
  )
}
