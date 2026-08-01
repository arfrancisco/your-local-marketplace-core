import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { ShopsPage } from './ShopsPage'
import { api } from '../api/client'
import type { Shop } from '../api/types'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      listShops: vi.fn(),
      openShop: vi.fn(),
      closeShop: vi.fn(),
    },
  }
})

const activeShop: Shop = {
  id: 1,
  name: "Lola's Kitchen",
  slug: 'lolas-kitchen',
  description: null,
  contact_number: null,
  address: null,
  fulfillment_methods: ['pickup'],
  status: 'active',
  accepting_orders: true,
  open: true,
  photos: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/shops" element={<ShopsPage />} />
        <Route path="/onboarding" element={<p>Onboarding page</p>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ShopsPage onboarding redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sends a vendor with zero shops to onboarding instead of an empty list', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [] })

    renderAt('/shops')

    expect(await screen.findByText('Onboarding page')).toBeInTheDocument()
  })

  it('does not redirect a vendor who already has a shop, and shows the normal list', async () => {
    vi.mocked(api.listShops).mockResolvedValue({ shops: [activeShop] })

    renderAt('/shops')

    expect(await screen.findByText("Lola's Kitchen")).toBeInTheDocument()
    expect(screen.queryByText('Onboarding page')).not.toBeInTheDocument()
  })
})
