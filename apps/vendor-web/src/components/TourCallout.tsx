import { useEffect, useRef } from 'react'

// A small positioned tooltip/callout used by each page's own opt-in "?"
// tour. Deliberately simple: the caller wraps the target field/element in a `.tour-anchor`
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
  /** Not pointing at any particular element — fixed in the middle of the
   * screen with no arrow, instead of absolutely positioned against a
   * `.tour-anchor` parent. For a general "here's what this page is" stop
   * that isn't about one specific field or button. */
  centered?: boolean
}

export function TourCallout({
  message,
  onNext,
  onSkip,
  nextLabel = 'Got it',
  strong = false,
  placement = 'bottom',
  centered = false,
}: TourCalloutProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Each step is a physically different TourCallout element gated behind
  // `tourStep === N` in the caller (see e.g. ShopFormPage), so a new one
  // mounts on every step advance — a mount-time effect is exactly "the tour
  // just moved to a new field." On a tall page a wide/tall screen already
  // shows the whole form at once, so this only visibly moves anything on
  // a small screen where the next field can be scrolled out of view;
  // scrolling the *anchor* (this element's parent, which wraps both the
  // field and this callout — see the module comment above) rather than the
  // callout itself keeps the actual field in view too, not just the tip.
  // A centered callout is fixed to the viewport, not positioned against a
  // scrolling parent, so there's nothing to scroll into view.
  useEffect(() => {
    if (centered) return
    ref.current?.parentElement?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [centered])

  return (
    <div
      ref={ref}
      className={`tour-callout ${centered ? 'centered' : placement}${strong ? ' strong' : ''}`}
      role="tooltip"
    >
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
