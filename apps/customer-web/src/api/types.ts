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
