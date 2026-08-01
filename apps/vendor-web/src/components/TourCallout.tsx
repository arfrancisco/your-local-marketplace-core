// A small positioned tooltip/callout used by the vendor onboarding tour
// (OnboardingPage + ShopFormPage/ShopsPage in onboardingMode). Deliberately
// simple: the caller wraps the target field/element in a `.tour-anchor`
// (position: relative) div and renders this inside it; this component itself
// is `position: absolute` via CSS (see index.css). No popover/floating-UI
// library — a handful of fixed placements is all the tour needs.
interface TourCalloutProps {
  message: string
  onNext: () => void
  onSkip: () => void
  nextLabel?: string
  /** Higher visual emphasis — used for the single most important callout
   * (the opening message/QR fields, since that's the entire payment
   * mechanism and easy to skip past otherwise). */
  strong?: boolean
  placement?: 'top' | 'bottom'
}

export function TourCallout({
  message,
  onNext,
  onSkip,
  nextLabel = 'Got it',
  strong = false,
  placement = 'bottom',
}: TourCalloutProps) {
  return (
    <div className={`tour-callout ${placement}${strong ? ' strong' : ''}`} role="tooltip">
      <button type="button" className="tour-callout-close" aria-label="Skip tour" onClick={onSkip}>
        ×
      </button>
      <p>{message}</p>
      <button type="button" className="tour-callout-next" onClick={onNext}>
        {nextLabel}
      </button>
    </div>
  )
}
