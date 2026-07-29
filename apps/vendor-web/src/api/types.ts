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
  status: 'draft' | 'active' | 'suspended'
  accepting_orders: boolean
  open: boolean
  photos: Photo[]
  created_at: string
  updated_at: string
}

export interface Item {
  id: number
  shop_id: number
  name: string
  description: string | null
  price_cents: number
  currency: string
  enabled: boolean
  position: number
  tags: Tag[]
  photos: Photo[]
}

export interface User {
  id: number
  email: string
  vendor_profile: { id: number; display_name: string; verification_status: string } | null
}
