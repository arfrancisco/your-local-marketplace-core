export interface Pagination {
  page: number
  per_page: number
  total_count: number
}

export interface AdminUser {
  id: number
  email: string
  mobile_number: string | null
  first_name: string | null
  last_name: string | null
  status: 'active' | 'suspended'
  email_verified: boolean
  mobile_verified: boolean
  email_marketing_opt_in: boolean
  sms_marketing_opt_in: boolean
  last_signed_in_at: string | null
  customer_profile: { id: number; display_name: string | null } | null
  vendor_profile: { id: number; display_name: string | null; verification_status: string } | null
  created_at: string
}

export interface AdminVendorProfile {
  id: number
  user_id: number
  user_email: string
  display_name: string | null
  verification_status: 'unverified' | 'pending' | 'verified' | 'rejected'
  shop_count: number
  created_at: string
}

export interface AdminCustomerProfile {
  id: number
  user_id: number
  user_email: string
  display_name: string | null
  is_resident: boolean | null
  willing_to_verify_residency: boolean | null
  default_address_id: number | null
  created_at: string
}

export interface Photo {
  id: number
  url: string
}

export interface AdminShop {
  id: number
  name: string
  slug: string
  description: string | null
  contact_number: string | null
  address: string | null
  fulfillment_methods: string[]
  status: 'draft' | 'active' | 'suspended'
  accepting_orders: boolean
  open: boolean
  photos: Photo[]
  opening_message?: string | null
  opening_message_photos?: Photo[]
  created_at: string
  updated_at: string
}

export interface Tag {
  id: number
  name: string
  slug: string
}

export interface AdminItem {
  id: number
  shop_id: number
  name: string
  description: string | null
  price_cents: number
  currency: string
  enabled: boolean
  stock_count: number | null
  sold_out: boolean
  position: number
  tags: Tag[]
  photos: Photo[]
  created_at: string
  updated_at: string
}

export interface AdminOrderLine {
  id: number
  item_id: number | null
  name: string
  unit_price_cents: number
  quantity: number
  line_total_cents: number
}

export interface AdminOrder {
  id: number
  public_reference: string
  shop_id: number
  status: string
  can_transition_to: string[]
  fulfillment_method: string
  subtotal_cents: number
  total_cents: number
  currency: string
  payment_status: string
  customer_note: string | null
  vendor_note: string | null
  items: AdminOrderLine[]
  placed_at: string | null
  accepted_at: string | null
  completed_at: string | null
  cancelled_at: string | null
  conversation_id: number | null
}

export interface AdminOrderStatusEvent {
  id: number
  order_id: number
  from_status: string | null
  to_status: string
  reason: string | null
  actor_user_id: number
  actor_user_email: string
  created_at: string
}

export interface AdminMessage {
  id: number
  conversation_id: number
  sender_user_id: number | null
  message_type: 'text' | 'image' | 'system'
  body: string | null
  image: Photo | null
  created_at: string
  edited_at: string | null
}

export interface AdminConversation {
  id: number
  order_id: number
  messages: AdminMessage[]
}

export interface AdminFeedbackSubmission {
  id: number
  user_id: number | null
  email: string | null
  message: string
  page_url: string | null
  resolved: boolean
  resolved_at: string | null
  created_at: string
}

export interface AdminErrorLog {
  id: number
  source: string
  exception_class: string
  message: string
  request_path: string | null
  request_method: string | null
  user_id: number | null
  fingerprint: string
  occurrences_count: number
  first_seen_at: string
  last_seen_at: string
  resolved: boolean
  resolved_at: string | null
  created_at: string
  // Only returned by the detail endpoint, not the list.
  backtrace?: string | null
}

export interface AdminApiToken {
  id: number
  user_id: number
  user_email: string
  expires_at: string | null
  revoked: boolean
  last_used_at: string | null
  created_at: string
}

export interface AdminVerificationChallenge {
  id: number
  user_id: number
  channel: 'email' | 'sms'
  purpose: string
  sent_to: string
  expired: boolean
  consumed: boolean
  consumed_at: string | null
  attempts_count: number
  expires_at: string
  created_at: string
}

export interface AdminAddress {
  id: number
  label: string | null
  recipient_name: string | null
  mobile_number: string | null
  unit: string | null
  building: string | null
  street_address: string | null
  city: string | null
  notes: string | null
  delivery_instructions: string | null
  created_at: string
}

export interface AdminCartLine {
  id: number
  item_id: number
  name: string
  price_cents: number
  currency: string
  quantity: number
  line_total_cents: number
}

export interface AdminCart {
  id: number
  shop_id: number
  status: 'active' | 'converted' | 'abandoned'
  items: AdminCartLine[]
  subtotal_cents: number
}

export interface AdminTag {
  id: number
  name: string
  slug: string
  item_count: number
}

export interface AdminEarlyAccessSignup {
  id: number
  email: string | null
  mobile_number: string | null
  name: string | null
  interest: 'buyer' | 'seller' | 'both'
  context: string | null
  created_at: string
}

// A real per-admin-operator account (AdminUser on the backend). Deliberately
// NOT named AdminUser here — that name is already taken above by the
// serialized *marketplace* User as seen by admin (id/email/status/
// customer_profile/vendor_profile), a completely different thing.
export interface AdminAccount {
  id: number
  email: string
  status: 'active' | 'suspended'
  first_name: string | null
  last_name: string | null
  last_signed_in_at: string | null
  created_at: string
}

export interface AdminAuditLogEntry {
  id: number
  admin_user_id: number | null
  http_method: string
  path: string
  controller: string
  action: string
  resource_type: string | null
  resource_id: number | null
  status_code: number
  created_at: string
}
