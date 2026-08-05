// In production both apps share one origin (vendor-web served under
// /vendor/*), so a relative path is correct there. Local dev runs them as
// two separate Vite dev servers on different ports/origins, where a
// relative path would just stay on customer-web's own origin — override
// with an absolute URL via VITE_VENDOR_WEB_BASE_URL for local dev/e2e.
const VENDOR_BASE = import.meta.env.VITE_VENDOR_WEB_BASE_URL || '/vendor'

export function vendorWebUrl(path: string): string {
  return `${VENDOR_BASE}${path}`
}
