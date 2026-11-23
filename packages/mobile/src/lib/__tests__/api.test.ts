import defaultApi, {
  api,
  workersApi,
  categoriesApi,
  userApi,
  contactRequestsApi,
  bookmarksApi,
  reviewsApi,
  tipsApi,
  escrowApi,
} from '../api'

describe('ApiClient', () => {
  const mockFetch = jest.fn()
  let originalFetch: typeof globalThis.fetch

  const jsonResponse = (overrides: Record<string, unknown> = {}) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: { get: jest.fn().mockReturnValue('application/json') },
    json: jest.fn().mockResolvedValue({ message: 'ok' }),
    text: jest.fn().mockResolvedValue('plain text'),
    ...overrides,
  })

  beforeEach(() => {
    mockFetch.mockReset()
    originalFetch = globalThis.fetch
    globalThis.fetch = mockFetch as unknown as typeof globalThis.fetch
    mockFetch.mockResolvedValue(jsonResponse())
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('builds the full URL with encoded query params and never sends a GET body', async () => {
    const res = await api.get('/workers', {
      category: 'home repair',
      page: 2,
      active: true,
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/workers?category=home%20repair&page=2&active=true')
    expect(init.method).toBe('GET')
    expect(init.body).toBeUndefined()
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
    })
    expect(res).toEqual({ ok: true, status: 200, statusText: 'OK', data: { message: 'ok' }, error: undefined })
  })

  it('strips duplicate slashes and works without params', async () => {
    await api.get('/categories/')

    expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:3000/api/categories/')
  })

  it('serialises the body and merges custom headers for non-GET requests', async () => {
    await api.request({ url: 'workers', method: 'PATCH', data: { name: 'A' }, headers: { 'X-Test': '1' } })

    const [, init] = mockFetch.mock.calls[0]
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe(JSON.stringify({ name: 'A' }))
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Test': '1',
    })
  })

  it('uses response.text() when the content type is not JSON', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      headers: { get: jest.fn().mockReturnValue('text/plain') },
    }))

    const res = await api.get('/workers')

    expect(res.data).toBe('plain text')
  })

  it('uses response.text() when there is no content-type header', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ headers: { get: jest.fn().mockReturnValue(null) } }))

    const res = await api.get('/workers')

    expect(res.data).toBe('plain text')
  })

  it('surfaces the server message for an error response', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      json: jest.fn().mockResolvedValue({ message: 'Invalid payload' }),
    }))

    const res = await api.post('/workers', {})

    expect(res.ok).toBe(false)
    expect(res.error).toBe('Invalid payload')
  })

  it('falls back to statusText when an error response has no message', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({
      ok: false,
      status: 503,
      statusText: 'Service Unavailable',
      json: jest.fn().mockResolvedValue({}),
    }))

    const res = await api.delete('/workers/w1')

    expect(res.error).toBe('Service Unavailable')
  })

  it('returns a network-error envelope when fetch rejects with an Error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

    const res = await api.get('/workers')

    expect(res).toEqual({
      ok: false,
      status: 0,
      statusText: 'Network Error',
      data: null,
      error: 'Connection refused',
    })
  })

  it('returns "Unknown error" when fetch rejects with a non-Error value', async () => {
    mockFetch.mockRejectedValueOnce('boom')

    const res = await api.get('/workers')

    expect(res.error).toBe('Unknown error')
  })

  it('exposes verb helpers that forward to request()', async () => {
    await api.put('/users/me', { a: 1 })
    await api.patch('/users/me', { b: 2 })
    await api.post('/users/me', { c: 3 })
    await api.delete('/users/me/1')

    expect(mockFetch.mock.calls.map(([, init]: [string, RequestInit]) => init.method)).toEqual([
      'PUT', 'PATCH', 'POST', 'DELETE',
    ])
  })

  it('exposes all resource helpers with the expected endpoints', async () => {
    await workersApi.getAll({ category: 'plumber' })
    await workersApi.getById('w1')
    await workersApi.search('pipe')
    await categoriesApi.getAll()
    await userApi.getProfile()
    await userApi.updateProfile({ firstName: 'A' })
    await contactRequestsApi.create({ workerId: 'w1', message: 'hello' })
    await contactRequestsApi.getMyRequests()
    await contactRequestsApi.getReceivedRequests()
    await bookmarksApi.getAll()
    await bookmarksApi.toggle('w1')
    await bookmarksApi.remove('w1')
    await reviewsApi.getByWorker('w1', { page: 1 })
    await reviewsApi.create('w1', { rating: 5, comment: 'great' })
    await tipsApi.send({ workerId: 'w1', amount: '1', asset: 'XLM' })
    await escrowApi.create({ workerId: 'w1', amount: '1', asset: 'XLM', description: 'job', expiryHours: 24 })
    await escrowApi.getMyEscrows()

    const urls = mockFetch.mock.calls.map(([url]: [string]) => url.replace('http://localhost:3000/api', ''))
    expect(urls).toEqual([
      '/workers?category=plumber',
      '/workers/w1',
      '/workers/search?q=pipe',
      '/categories',
      '/users/me',
      '/users/me',
      '/contact-requests',
      '/contact-requests',
      '/contact-requests/received',
      '/bookmarks',
      '/bookmarks',
      '/bookmarks/w1',
      '/workers/w1/reviews?page=1',
      '/workers/w1/reviews',
      '/tips',
      '/escrow',
      '/escrow',
    ])
    expect(defaultApi).toBe(api)
  })
})
