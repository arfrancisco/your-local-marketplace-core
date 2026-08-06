import { Link } from 'react-router-dom'

// A static, informational splash — not a state machine. Reached from
// customer-web's "become a vendor" redirect, or from ShopDashboardPage's
// own no-shop redirect (a vendor with no shop has nothing useful to do on
// /shops). It's not shop-count-aware: any vendor can revisit it any time,
// same as any other page. Each real page (ShopFormPage, ShopDashboardPage,
// ShopPreviewPage, ItemsPage, OrderDetailPage) owns its own optional,
// on-demand tour behind a "?" button (HelpTourButton) instead of this page
// forcing anyone through a guided sequence.
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
        <li>
          <strong>Shops here are a real, ongoing thing</strong> — whether it's home-cooked
          food, baked goods, or handmade crafts, we're looking for neighbors who'll keep
          selling, not a one-time declutter sale.
        </li>
      </ul>
      <Link className="button" to="/shops/new">Get started</Link>
    </div>
  )
}
