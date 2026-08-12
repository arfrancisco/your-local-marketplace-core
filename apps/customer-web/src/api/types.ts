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
  // Public-safe location label only ("Tower B") — the vendor's exact unit
  // is never sent to this app; it's private to the vendor themselves and to
  // an order's two participants (see the API's ShopSerializer).
  building: string | null
  fulfillment_methods: FulfillmentMethod[]
  open: boolean
  // Shop identity images (Facebook-style) — profile_photo is the small
  // square thumbnail used on shop lists/cards, cover_photo is the wide hero
  // on the shop's own page. Either can be null if the vendor hasn't set one.
  profile_photo: Photo | null
  cover_photo: Photo | null
  // null when the shop has no reviews yet — render "no reviews", never "0 stars".
  average_rating: number | null
  ratings_count: number
  // null when the shop has no enabled items to price yet.
  price_range_cents: { min: number; max: number } | null
  // Completed orders only, not a raw order count (see ShopSerializer).
  completed_orders_count: number
  // Seed/demo data, not a real neighbor's shop — see ShopSerializer. An
  // order placed against a demo shop is never actually fulfilled, so this
  // must stay visible everywhere a customer could place an order.
  demo: boolean
  // Binary only (no pending/rejected) — see ShopSerializer. Admin-verified
  // via docs/legal's residency-style workflow, not automatic.
  verified: boolean
}

export interface Rating {
  id: number
  score: number
  comment: string | null
  reviewer_display_name: string
  created_at: string
}

export interface Item {
  id: number
  shop_id: number
  name: string
  description: string | null
  price_cents: number
  currency: string
  enabled: boolean
  // null = stock not tracked for this item. sold_out is a computed
  // convenience (stock_count !== null && stock_count <= 0) — unlike
  // `enabled: false` (vendor-hidden, never returned here), a sold-out item
  // is still returned to customers and should render grayed-out, not hidden.
  stock_count: number | null
  sold_out: boolean
  tags: Tag[]
  photos: Photo[]
  demo: boolean
}

export interface User {
  id: number
  email: string
  mobile_number: string | null
  first_name: string | null
  last_name: string | null
  status: string
  email_verified: boolean
  mobile_verified: boolean
  email_marketing_opt_in: boolean
  sms_marketing_opt_in: boolean
  // Per-event SMS toggles for order-lifecycle notifications, all default
  // true. sms_notify_order_placed also exists on the underlying user record
  // but is vendor-only (a vendor is notified when a customer places an
  // order) and is never returned to this app.
  sms_notify_order_accepted: boolean
  sms_notify_order_ready: boolean
  sms_notify_order_completed: boolean
  last_signed_in_at: string | null
  created_at: string
  customer_profile: {
    id: number
    display_name: string
    default_address_id: number | null
    is_resident: boolean
    willing_to_verify_residency: boolean | null
  } | null
  vendor_profile: { id: number; display_name: string; verification_status: string } | null
  vendor_eligibility: { eligible: boolean; reasons: string[] }
}

export interface Address {
  id: number
  recipient_name: string | null
  mobile_number: string | null
  building: string
  unit: string | null
  street_address: string | null
  city: string | null
  notes: string | null
  delivery_instructions: string | null
}

export interface CartLine {
  id: number
  item_id: number
  name: string
  price_cents: number
  currency: string
  quantity: number
  line_total_cents: number
}

export interface Cart {
  id: number
  shop_id: number
  status: string
  items: CartLine[]
  subtotal_cents: number
}

// Matches Order::CUSTOMER_CANCELLATION_REASONS on the backend.
export type CancellationReasonCode =
  | 'changed_mind'
  | 'found_elsewhere'
  | 'taking_too_long'
  | 'ordered_by_mistake'
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
  shop_name: string
  // Building only — never the vendor's exact unit, for the vendor's safety.
  shop_building: string | null
  shop_profile_photo: Photo | null
  shop_average_rating: number | null
  shop_ratings_count: number
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
  has_unread_messages: boolean
  // At most one — only the customer rates, and only once (M4).
  rating: Rating | null
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
