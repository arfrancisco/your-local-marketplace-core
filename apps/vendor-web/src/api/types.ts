export interface Photo {
  id: number
  url: string
  filename: string
  byte_size: number
  content_type: string
}

export interface Tag {
  id: number
  name: string
  slug: string
}

export type FulfillmentMethod = 'pickup' | 'delivery'

export interface Shop {
  id: number
  name: string
  slug: string
  description: string | null
  contact_number: string | null
  // Public-safe location label ("Tower B") — always present, safe on any
  // shop payload. `address` (the exact unit) is vendor-only, see below.
  building: string | null
  fulfillment_methods: FulfillmentMethod[]
  status: 'draft' | 'active' | 'suspended'
  accepting_orders: boolean
  open: boolean
  // Shop identity images (Facebook-style) — profile_photo is the small
  // square thumbnail used on shop lists/cards, cover_photo is the wide hero
  // on the shop's own page. Either can be null if not set yet.
  profile_photo: Photo | null
  cover_photo: Photo | null
  // Public standing, same values customers see. null average when unrated —
  // render "no reviews", never "0 stars".
  average_rating: number | null
  ratings_count: number
  // Vendor-only — never present on shop payloads served to customers (see
  // ShopSerializer's include_payment_info flag on the API). Read by order
  // participants live via Order.opening_message/opening_message_photos.
  opening_message?: string | null
  opening_message_photos?: Photo[]
  // The exact unit, e.g. "Unit 7A" — vendor-only, same gate as above.
  // Never shown to a customer; share it via the opening message if needed.
  address?: string | null
  created_at: string
  updated_at: string
}

// Matches Order::VENDOR_CANCELLATION_REASONS on the backend.
export type CancellationReasonCode =
  | 'item_unavailable'
  | 'unable_to_fulfill'
  | 'customer_unreachable'
  | 'emergency_closure'
  | 'other'

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready_for_pickup'
  | 'out_for_delivery'
  | 'completed'
  | 'rejected'
  | 'cancelled'

export interface OrderLineItem {
  id: number
  item_id: number | null
  name: string
  unit_price_cents: number
  quantity: number
  line_total_cents: number
}

export interface Order {
  id: number
  public_reference: string
  shop_id: number
  customer_profile_id: number
  // Customer identity/logistics info, live-read from the profile rather than
  // snapshotted — a customer has exactly one address record (editing it in
  // place if they move), so there's nothing to snapshot in the first place.
  customer_name: string
  customer_is_resident: boolean
  customer_building: string | null
  customer_unit: string | null
  status: OrderStatus
  can_transition_to: OrderStatus[]
  fulfillment_method: FulfillmentMethod
  subtotal_cents: number
  total_cents: number
  currency: string
  payment_status: 'unpaid' | 'marked_paid'
  customer_note: string | null
  vendor_note: string | null
  items: OrderLineItem[]
  // Read live off the shop, not snapshotted — a pinned panel above chat,
  // not a chat message (ADR 0009, revised).
  opening_message: string | null
  opening_message_photos: Photo[]
  placed_at: string
  accepted_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  conversation_id: number | null
  // The customer's review of this order, once they leave one. Read-only for
  // vendors this phase — they can't review back yet.
  rating: Rating | null
}

export interface Rating {
  id: number
  score: number
  comment: string | null
  reviewer_display_name: string
  created_at: string
}

export interface Message {
  id: number
  conversation_id: number
  sender_user_id: number | null
  message_type: 'text' | 'image' | 'system'
  body: string | null
  image: Photo | null
  created_at: string
  edited_at: string | null
}

export interface Item {
  id: number
  shop_id: number
  name: string
  description: string | null
  price_cents: number
  currency: string
  enabled: boolean
  // Archiving (separate from `enabled`) retires an item from the vendor's
  // own active inventory list, hiding it from customers regardless of
  // `enabled` — non-destructive, reversible via unarchive. `enabled` alone
  // is a temporary customer-visibility toggle, not a "done with this" signal.
  archived: boolean
  // null = not tracked (default/existing behavior for every item). A number
  // is the vendor-entered stock on hand; sold_out is computed server-side
  // from it (present and <= 0). Independent of `enabled`: enabled is the
  // vendor's manual publish/unpublish switch, sold_out is a separate
  // "still listed but grayed-out to customers" signal.
  stock_count: number | null
  sold_out: boolean
  position: number
  tags: Tag[]
  photos: Photo[]
}

// One turn in the vendor's chat with the inventory assistant. No `image`/
// `system` variant here — just the vendor's own messages and the
// assistant's narrated replies (see Assistant::HandleMessage on the API).
export interface AssistantMessage {
  id: number
  role: 'user' | 'assistant'
  body: string
  created_at: string
}

// A vendor's private note about a customer. Only ever readable by the vendor
// who wrote it: never the customer it is about, never another vendor. Not a
// rating and not related to one.
export interface VendorCustomerNote {
  id: number
  customer_profile_id: number
  order_id: number | null
  note: string
  flagged: boolean
  created_at: string
  updated_at: string
}

export interface User {
  id: number
  email: string
  vendor_profile: { id: number; display_name: string; verification_status: string } | null
}
