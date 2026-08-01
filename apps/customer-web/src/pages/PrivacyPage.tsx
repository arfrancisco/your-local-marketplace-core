import privacyContent from '../legal/privacy-policy.md?raw'
import { LegalDoc } from '../components/LegalDoc'

// Public — reachable from screen 1 of registration before an account exists.
// This is a copy of the repo root's docs/legal/privacy-policy.md (not
// imported directly — Vite's dev server restricts serving files outside
// the project root by default). Keep both in sync if the legal text is
// ever edited; docs/legal/ is the canonical source.
export function PrivacyPage() {
  return <LegalDoc content={privacyContent} />
}
