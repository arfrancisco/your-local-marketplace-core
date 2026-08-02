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
  address: string | null
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
