// In production both apps share one origin (customer-web served at /,
// vendor-web under /vendor/*, per apps/vendor-web/src/api/client.ts), so a
// relative path is correct there. Local dev runs them as two separate Vite
// dev servers on different ports/origins, where a relative path would just
// stay on vendor-web's own origin — override with an absolute URL via
// VITE_CUSTOMER_WEB_BASE_URL for local dev/e2e. Mirrors customer-web's own
// vendorWeb.ts exactly, crossing the same app boundary the other direction.
const CUSTOMER_BASE = import.meta.env.VITE_CUSTOMER_WEB_BASE_URL || ''

export function customerWebUrl(path: string): string {
  return `${CUSTOMER_BASE}${path}`
}
