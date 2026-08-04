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

  it('appends the error id to the message when the backend provides one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({
          error: { code: 'internal_error', message: 'Something went wrong on our end', details: { error_id: 42 } },
        }),
      }),
    )

    await expect(api.listShops()).rejects.toMatchObject({
      constructor: ApiError,
      status: 500,
      message: expect.stringContaining('Error ID: 42'),
    })
  })

  it('reports a 5xx to /client_errors without changing what the caller sees', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'internal_error', message: 'Something went wrong on our end' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.listShops()).rejects.toMatchObject({ constructor: ApiError, status: 500 })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [reportUrl] = fetchMock.mock.calls[1]
    expect(reportUrl).toMatch(/\/client_errors$/)
  })

  it('does not report a 4xx to /client_errors (expected/business errors are not bugs)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: { code: 'validation_failed', message: 'Validation failed' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.listShops()).rejects.toMatchObject({ constructor: ApiError, status: 422 })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports a network-level failure to /client_errors and still rejects with the original error', async () => {
    const networkError = new TypeError('Failed to fetch')
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(networkError)
      .mockResolvedValue({ ok: true, status: 201, json: async () => ({ status: 'received', error_id: 7 }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.listShops()).rejects.toBe(networkError)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const [reportUrl] = fetchMock.mock.calls[1]
    expect(reportUrl).toMatch(/\/client_errors$/)
  })

  it('does not recurse when /client_errors itself fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { code: 'internal_error', message: 'Something went wrong on our end' } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { reportClientError } = await import('./client')
    const errorId = await reportClientError({ name: 'TypeError', message: 'boom' })

    expect(errorId).toBeUndefined()
    // Exactly one call (the report itself) — no follow-up report-about-the-report.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
