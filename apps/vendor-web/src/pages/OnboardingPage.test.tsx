import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { OnboardingPage } from './OnboardingPage'
import { api } from '../api/client'

vi.mock('../api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client')>()
  return {
    ...actual,
    api: {
      ...actual.api,
      createShop: vi.fn(),
      listShops: vi.fn(),
      openShop: vi.fn(),
      closeShop: vi.fn(),
    },
  }
})

describe('OnboardingPage', () => {
  it('shows the no-payment welcome framing before anything else', () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    expect(screen.getByText(/there's no payment in this app/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /get started/i })).toBeInTheDocument()
  })

  it('advances to the guided shop form after Get started, with the payment callout shown first', async () => {
    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /get started/i }))

    expect(await screen.findByRole('heading', { name: /new shop/i })).toBeInTheDocument()
    expect(screen.getByText(/this is how you get paid/i)).toBeInTheDocument()
  })

  it('advances to the dashboard tour once the shop form saves successfully', async () => {
    vi.mocked(api.createShop).mockResolvedValue({
      shop: { id: 1, name: 'New Shop', fulfillment_methods: ['pickup'], open: false, photos: [] } as never,
    })
    vi.mocked(api.listShops).mockResolvedValue({
      shops: [
        {
          id: 1,
          name: 'New Shop',
          slug: 'new-shop',
          description: null,
          contact_number: null,
          address: null,
          fulfillment_methods: ['pickup'],
          status: 'draft',
          accepting_orders: false,
          open: false,
          photos: [],
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        } as never,
      ],
    })

    render(
      <MemoryRouter>
        <OnboardingPage />
      </MemoryRouter>,
    )

    await userEvent.click(screen.getByRole('button', { name: /get started/i }))
    await userEvent.type(await screen.findByLabelText('Name'), 'New Shop')
    // Move past the two form callouts so they don't obscure the submit button.
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    await userEvent.click(screen.getByRole('button', { name: 'Got it' }))
    await userEvent.click(screen.getByRole('button', { name: /save shop/i }))

    // Lands on the real ShopDashboardPage, tour already underway — first
    // stop is the open/close control's callout.
    expect(await screen.findByRole('heading', { name: 'New Shop' })).toBeInTheDocument()
    expect(screen.getByText(/toggle your shop open or closed/i)).toBeInTheDocument()
  })
})
