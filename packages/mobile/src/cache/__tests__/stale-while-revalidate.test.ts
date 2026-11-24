import { renderHook, act } from '@testing-library/react-native'
import { useQuery } from '@tanstack/react-query'
import {
  useStaleWhileRevalidate,
  useOfflineQuery,
  prefetchAndCache,
} from '../stale-while-revalidate'
import { cacheStore } from '../cache-store'

jest.mock('../cache-store', () => ({
  cacheStore: {
    getCachedData: jest.fn(),
    isStale: jest.fn(),
    setCacheEntry: jest.fn(),
  },
}))

const queryMock = useQuery as jest.Mock
const store = cacheStore as jest.Mocked<typeof cacheStore>

const queryFn = jest.fn().mockResolvedValue('network data')

function setQuery(overrides: Record<string, unknown> = {}) {
  queryMock.mockReturnValue({
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
    ...overrides,
  })
}

describe('useStaleWhileRevalidate', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    queryFn.mockResolvedValue('network data')
    store.getCachedData.mockReturnValue(null)
    store.isStale.mockReturnValue(false)
    setQuery()
  })

  it('returns query state, derives the cache key and reports staleness', () => {
    setQuery({ data: { id: 1 }, isLoading: false })

    const { result } = renderHook(() =>
      useStaleWhileRevalidate({ queryKey: ['workers', 'all'], queryFn })
    )

    expect(result.current.data).toEqual({ id: 1 })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.isFromCache).toBe(false)
    expect(result.current.isStale).toBe(false)
    expect(result.current.isError).toBe(false)
    expect(result.current.error).toBeNull()
    expect(typeof result.current.refetch).toBe('function')
    expect(store.getCachedData).toHaveBeenCalledWith('cache:query:workers:all')
    expect(store.setCacheEntry).toHaveBeenCalledWith(
      'cache:query:workers:all',
      { id: 1 },
      undefined,
      undefined
    )
    expect(queryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: ['workers', 'all'],
        enabled: true,
        staleTime: 1000 * 60 * 60,
        gcTime: 1000 * 60 * 60 * 24,
        retry: 2,
      })
    )
  })

  it('uses custom cache key, ttl, staleTime and calls onSuccess', () => {
    const onSuccess = jest.fn()
    setQuery({ data: 'fresh' })

    renderHook(() =>
      useStaleWhileRevalidate({
        queryKey: ['custom'],
        queryFn,
        cacheKey: 'custom:key',
        ttl: 100,
        staleTime: 50,
        onSuccess,
      })
    )

    expect(store.setCacheEntry).toHaveBeenCalledWith('custom:key', 'fresh', 100, 50)
    expect(onSuccess).toHaveBeenCalledWith('fresh')
    expect(queryMock).toHaveBeenCalledWith(expect.objectContaining({ enabled: true, staleTime: 50 }))
    expect(store.getCachedData).toHaveBeenCalledWith('custom:key')
  })

  it('marks data as coming from cache and hides the loading state', () => {
    store.getCachedData.mockReturnValue({ id: 2 })
    setQuery({ data: undefined, isLoading: true })

    const { result } = renderHook(() =>
      useStaleWhileRevalidate({ queryKey: ['cached'], queryFn })
    )

    expect(result.current.isFromCache).toBe(true)
    expect(result.current.isLoading).toBe(false)
  })

  it('does not read the cache when the query is disabled', () => {
    setQuery({ data: undefined, isLoading: true })

    const { result } = renderHook(() =>
      useStaleWhileRevalidate({ queryKey: ['off'], queryFn, enabled: false })
    )

    expect(store.getCachedData).not.toHaveBeenCalled()
    expect(result.current.isFromCache).toBe(false)
    expect(result.current.isLoading).toBe(true)
  })

  it('refreshes briefly when cached data is stale and stops after 500ms', () => {
    jest.useFakeTimers()
    try {
      store.getCachedData.mockReturnValue({ id: 3 })
      store.isStale.mockReturnValue(true)
      setQuery({ data: { id: 3 } })

      const { result } = renderHook(() =>
        useStaleWhileRevalidate({ queryKey: ['stale'], queryFn })
      )

      expect(result.current.isRefreshing).toBe(true)
      expect(store.setCacheEntry).toHaveBeenCalled()

      act(() => {
        jest.advanceTimersByTime(500)
      })

      expect(result.current.isRefreshing).toBe(false)
    } finally {
      jest.useRealTimers()
    }
  })

  it('forwards query errors to onError', () => {
    const error = new Error('query failed')
    const onError = jest.fn()
    setQuery({ error, isError: true })

    const { result } = renderHook(() =>
      useStaleWhileRevalidate({ queryKey: ['error'], queryFn, onError })
    )

    expect(onError).toHaveBeenCalledWith(error)
    expect(result.current.isError).toBe(true)
    expect(result.current.error).toBe(error)
  })

  it('does not call optional callbacks when they are omitted', () => {
    setQuery({ data: 'x', error: new Error('e') })

    expect(() =>
      renderHook(() => useStaleWhileRevalidate({ queryKey: ['no-callbacks'], queryFn }))
    ).not.toThrow()
  })
})

describe('useOfflineQuery', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    store.getCachedData.mockReturnValue(null)
    store.isStale.mockReturnValue(false)
    setQuery()
  })

  it('falls back to fallbackData while loading with no data', () => {
    setQuery({ data: undefined, isLoading: true })

    const { result } = renderHook(() =>
      useOfflineQuery({ queryKey: ['q'], queryFn, fallbackData: 'fallback' })
    )

    expect(result.current.data).toBe('fallback')
    expect(result.current.isLoading).toBe(false)
  })

  it('uses cached data when the query errors and there is no data', () => {
    store.getCachedData.mockReturnValue('cached value')
    setQuery({ data: undefined, isError: true, error: new Error('offline') })

    const { result } = renderHook(() =>
      useOfflineQuery({ queryKey: ['q'], queryFn })
    )

    expect(result.current.data).toBe('cached value')
    expect(result.current.isError).toBe(false)
    expect(result.current.error).toBeUndefined()
    expect(result.current.isLoading).toBe(false)
  })

  it('returns the untouched result when data is available', () => {
    setQuery({ data: 'fresh value' })

    const { result } = renderHook(() =>
      useOfflineQuery({ queryKey: ['q'], queryFn, fallbackData: 'fallback' })
    )

    expect(result.current.data).toBe('fresh value')
  })

  it('returns the untouched error result when there is no cached data', () => {
    setQuery({ data: undefined, isError: true, error: new Error('offline') })

    const { result } = renderHook(() =>
      useOfflineQuery({ queryKey: ['q'], queryFn })
    )

    expect(result.current.isError).toBe(true)
    expect(result.current.data).toBeUndefined()
  })
})

describe('prefetchAndCache', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches and caches with an explicit cache key', async () => {
    queryFn.mockResolvedValueOnce({ id: 1 })

    await expect(prefetchAndCache(['k'], queryFn, 'explicit:key', 10, 20)).resolves.toEqual({ id: 1 })
    expect(store.setCacheEntry).toHaveBeenCalledWith('explicit:key', { id: 1 }, 10, 20)
  })

  it('derives the default cache key from the query key', async () => {
    queryFn.mockResolvedValueOnce('data')

    await expect(prefetchAndCache(['a', 'b'], queryFn)).resolves.toBe('data')
    expect(store.setCacheEntry).toHaveBeenCalledWith('cache:query:a:b', 'data', undefined, undefined)
  })

  it('falls back to cached data when the fetch fails', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    queryFn.mockRejectedValueOnce(new Error('offline'))
    store.getCachedData.mockReturnValueOnce('cached data')

    await expect(prefetchAndCache(['k'], queryFn)).resolves.toBe('cached data')
    expect(store.setCacheEntry).not.toHaveBeenCalled()
    expect(store.getCachedData).toHaveBeenCalledWith('cache:query:k')
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })

  it('returns null when the fetch fails and nothing is cached', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    queryFn.mockRejectedValueOnce(new Error('offline'))
    store.getCachedData.mockReturnValueOnce(null)

    await expect(prefetchAndCache(['k'], queryFn, 'key')).resolves.toBeNull()
    errorSpy.mockRestore()
  })

  it('waits for the query function before caching', async () => {
    let resolveQuery!: (value: string) => void
    queryFn.mockImplementationOnce(() => new Promise((resolve) => { resolveQuery = resolve }))

    const promise = prefetchAndCache(['async'], queryFn)
    expect(store.setCacheEntry).not.toHaveBeenCalled()

    await act(async () => {
      resolveQuery('done')
      await promise
    })

    expect(store.setCacheEntry).toHaveBeenCalledWith('cache:query:async', 'done', undefined, undefined)
  })
})

export {}
