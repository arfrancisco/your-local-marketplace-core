import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShopFormPage } from './ShopFormPage'
import { ShopDashboardPage } from './ShopDashboardPage'

// Reached two ways: a full-page redirect from customer-web right after a
// "become a vendor" upgrade, or ShopDashboardPage's own no-shop redirect (a
// vendor with no shop has nothing useful to do on /shops). Either way the
// three steps below are the same, and steps 2/3 reuse the real
// ShopFormPage/ShopDashboardPage components in onboardingMode rather than forking
// them — the tour is just callouts layered on top of the real UI.
type Step = 'welcome' | 'shop' | 'dashboard'

export function OnboardingPage() {
  const [step, setStep] = useState<Step>('welcome')
  const navigate = useNavigate()

  if (step === 'welcome') {
    return (
      <div className="card onboarding-welcome">
        <h1>Welcome to your vendor dashboard</h1>
        <p className="muted">
          A few things that work differently here than a typical online store:
        </p>
        <ul>
          <li>
            <strong>There's no payment in this app.</strong> You get paid directly by whatever
            method you publish — GCash, bank transfer, cash on pickup, whatever you use. You'll
            set that up as your shop's "opening message" in the next step, and customers see it
            pinned above every order's chat with you.
          </li>
          <li>
            <strong>Order status only moves when you click a button.</strong> Nothing is ever
            inferred from chat messages — you're always the one in control of what stage an
            order is in.
          </li>
          <li>
            <strong>Every order has its own private chat</strong> with that customer, for
            coordinating pickup or delivery details, or sharing proof of payment.
          </li>
        </ul>
        <button type="button" onClick={() => setStep('shop')}>Get started</button>
      </div>
    )
  }

  if (step === 'shop') {
    return <ShopFormPage onboardingMode onSaved={() => setStep('dashboard')} />
  }

  return (
    <ShopDashboardPage onboardingMode onTourDone={() => navigate('/shops', { replace: true })} />
  )
}
