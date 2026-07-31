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
  photos: Photo[]
}

export interface Item {
  id: number
  shop_id: number
  name: string
  description: string | null
  price_cents: number
  currency: string
  enabled: boolean
  tags: Tag[]
  photos: Photo[]
}

export interface User {
  id: number
  email: string
  customer_profile: { id: number; display_name: string; default_address_id: number | null } | null
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
