import '@testing-library/jest-dom'

// jsdom implements no scroll/layout behavior at all — not even a no-op
// stub for this one, unlike some other DOM APIs. TourCallout.tsx calls it
// on mount to bring the tour's current step into view.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
