import termsContent from '../legal/terms-and-conditions.md?raw'
import { LegalDoc } from '../components/LegalDoc'

// Public — reachable from screen 1 of registration before an account exists.
// This is a copy of the repo root's docs/legal/terms-and-conditions.md
// (not imported directly — Vite's dev server restricts serving files
// outside the project root by default). Keep both in sync if the legal
// text is ever edited; docs/legal/ is the canonical source.
export function TermsPage() {
  return <LegalDoc content={termsContent} />
}
