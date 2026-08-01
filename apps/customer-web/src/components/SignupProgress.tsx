// Segments up to and including the current step read as "filled" — since the
// 3-screen flow only ever moves forward, being on step 3 means step 2 is
// "passed" whether it was confirmed or skipped, with no separate tracking
// needed for that distinction.
export function SignupProgress({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="signup-progress">
      <p className="muted small">Step {step} of 3</p>
      <div className="progress-bar">
        {[1, 2, 3].map((s) => (
          <div key={s} className={`progress-segment ${s <= step ? 'filled' : ''}`} />
        ))}
      </div>
    </div>
  )
}
