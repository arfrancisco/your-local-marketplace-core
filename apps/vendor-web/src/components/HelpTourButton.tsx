interface HelpTourButtonProps {
  onClick: () => void
  label: string
}

// The lower-left "?" trigger for a page's own opt-in tour — the deliberate
// mirror of ItemsPage's lower-right "+" add-item FAB (see .help-tour-anchor/
// .add-item-fab-anchor in index.css, same fixed-corner formula on opposite
// edges). Holds no state itself, same shape TourCallout already has: every
// page owns its own tourOpen/tourStep locally and just tells this button
// what to do when clicked.
export function HelpTourButton({ onClick, label }: HelpTourButtonProps) {
  return (
    <div className="help-tour-anchor">
      <button type="button" className="help-tour-btn" aria-label={label} onClick={onClick}>
        ?
      </button>
    </div>
  )
}
