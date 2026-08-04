interface Props {
  name: string
  building: string | null
  unit: string | null
  isResident: boolean
  // The order detail page pulls the non-resident badge out into its own
  // tags row above the card (alongside the status badge), rather than
  // inline here, so more tags can be added there later without crowding
  // the customer line. List cards keep it inline (the default).
  showResidentBadge?: boolean
}

// Shared customer identity/logistics block rendered on both the order list
// cards (OrderList.tsx) and the order detail page (OrderDetailPage.tsx), so
// the fallback rules for "no address on file" and the non-resident badge
// only live in one place. A customer has exactly one address on file — if
// they move, they edit that same record — so this is just "the address,"
// no "current as of" caveat needed.
export function CustomerSummary({
  name,
  building,
  unit,
  isResident,
  showResidentBadge = true,
}: Props) {
  return (
    <div className="row gap customer-summary">
      <span className="customer-name">{name}</span>
      {building ? (
        <span className="customer-address">
          {building}
          {unit ? `, Unit ${unit}` : ''}
        </span>
      ) : (
        <span className="muted">No address on file</span>
      )}
      {showResidentBadge && !isResident && <span className="non-resident-badge">Not a resident</span>}
    </div>
  )
}
