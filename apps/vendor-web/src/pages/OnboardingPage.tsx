import { Link } from 'react-router-dom'
import { ONBOARDING_STEPS, stepPath } from '../onboarding'

// The wizard's front door: an informational splash, with no stepper of its
// own, that hands off to the real 4-step setup flow (pages/onboarding/).
// Setup used to stop here — a single "New shop" form did the whole job and
// this page deliberately wasn't a state machine — but shop creation, photos,
// items and payment are now four recorded steps a vendor can leave and
// resume (shops.onboarding_step). Reached from customer-web's "become a
// vendor" redirect, or from ShopDashboardPage's own no-shop redirect.
export function OnboardingPage() {
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
          set that up as your shop's "opening message" in the last step, and customers see it
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
        <li>
          <strong>Shops here are a real, ongoing thing</strong> — whether it's home-cooked
          food, baked goods, or handmade crafts, we're looking for neighbors who'll keep
          selling, not a one-time declutter sale.
        </li>
      </ul>
      <Link className="button" to={stepPath(ONBOARDING_STEPS[0])}>Get started</Link>
      <p className="muted small">
        Setting up takes about {ONBOARDING_STEPS.length} short steps. You can stop anytime and
        pick up where you left off.
      </p>
    </div>
  )
}
