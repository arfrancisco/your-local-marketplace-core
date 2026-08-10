import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { useBecomeVendor } from './useBecomeVendor'
import { api, ApiError } from './api/client'

vi.mock('./api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api/client')>()
  return {
    ...actual,
    api: { ...actual.api, becomeVendor: vi.fn() },
  }
})

let location: ReturnType<typeof useLocation> | null = null

function LocationSpy() {
  location = useLocation()
  return null
}

function renderWithHook() {
  const hook = renderHook(() => useBecomeVendor(), {
    wrapper: ({ children }) => (
      <MemoryRouter initialEntries={['/shops']}>
        <Routes>
          <Route path="*" element={<>{children}<LocationSpy /></>} />
        </Routes>
      </MemoryRouter>
    ),
  })
  return hook
}

describe('useBecomeVendor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    location = null
  })

  it('navigates to vendor-web onboarding on success', async () => {
    vi.mocked(api.becomeVendor).mockResolvedValue({ user: {} as never })
    const originalHref = window.location.href
    const hrefSetter = vi.fn()
    Object.defineProperty(window, 'location', {
      value: { ...window.location, set href(v: string) { hrefSetter(v) } },
      writable: true,
    })

    const { result } = renderWithHook()
    await act(async () => {
      await result.current.start()
    })

    expect(hrefSetter).toHaveBeenCalledWith(expect.stringContaining('/onboarding'))
    window.location.href = originalHref
  })

  it('shows the email-verify modal when the only blocking reason is email_not_verified', async () => {
    vi.mocked(api.becomeVendor).mockRejectedValue(
      new ApiError(403, 'forbidden', 'Not eligible', { reasons: ['email_not_verified'] }),
    )

    const { result } = renderWithHook()
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.showEmailVerifyModal).toBe(true)
    expect(location?.pathname).toBe('/shops')
  })

  it('navigates to /account for any other or multiple reasons', async () => {
    vi.mocked(api.becomeVendor).mockRejectedValue(
      new ApiError(403, 'forbidden', 'Not eligible', { reasons: ['not_resident'] }),
    )

    const { result } = renderWithHook()
    await act(async () => {
      await result.current.start()
    })

    expect(result.current.showEmailVerifyModal).toBe(false)
    await waitFor(() => expect(location?.pathname).toBe('/account'))
  })
})
