import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, setToken, ApiError } from './client'

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('sends the bearer token and returns the shop list', async () => {
    setToken('tok123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ shops: [{ id: 1, slug: 'corner-kitchen' }] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await api.listShops()

    expect(res.shops).toHaveLength(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/shops$/)
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok123')
  })

  it('raises ApiError from the error envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: 'unauthorized', message: 'Authentication required' } }),
      }),
    )

    await expect(api.listShops()).rejects.toMatchObject({ constructor: ApiError, status: 401 })
  })
})
