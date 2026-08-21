// Ported from customer-web's SignupProgress (ADR 0001 — the two apps
// duplicate rather than share a package), generalized from its hardcoded
// 3-screen signup to any step/total, and repainted in vendor-web's own
// palette: filled segments are the vendor blue (#1e40af), unfilled the
// same neutral grey used for borders here. customer-web's warm cream and
// green belong to that app's palette, not this one.
//
// Segments up to and including the current step read as "filled" — the
// wizard only ever moves forward, so being on step 3 means steps 1 and 2
// are passed whether they were completed or skipped.
export function SetupProgress({
  step,
  total,
  showLabel = true,
}: {
  step: number
  total: number
  /** Off when the surrounding copy already says which step this is (the
   * dashboard's resume banner), so the count isn't printed twice. */
  showLabel?: boolean
}) {
  return (
    <div className="setup-progress">
      {showLabel && <p className="muted small">Step {step} of {total}</p>}
      <div className="progress-bar">
        {Array.from({ length: total }, (_, index) => (
          <div key={index} className={`progress-segment ${index < step ? 'filled' : ''}`} />
        ))}
      </div>
    </div>
  )
}
