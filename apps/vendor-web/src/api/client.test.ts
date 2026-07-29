import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api, setToken, ApiError } from './client'

describe('api client', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('attaches the bearer token and parses the response', async () => {
    setToken('tok123')
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ shops: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const res = await api.listShops()

    expect(res.shops).toEqual([])
    const [, opts] = fetchMock.mock.calls[0]
    expect((opts.headers as Record<string, string>).Authorization).toBe('Bearer tok123')
  })

  it('raises ApiError carrying the envelope on failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: { code: 'validation_failed', message: 'Validation failed' } }),
      }),
    )

    await expect(api.createShop(new FormData())).rejects.toMatchObject({
      constructor: ApiError,
      status: 422,
      code: 'validation_failed',
    })
  })
})
