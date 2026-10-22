import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAsyncState } from '@/hooks/useAsyncState'

describe('useAsyncState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with null data, false loading, and null error', () => {
    const { result } = renderHook(() => useAsyncState(async () => 'data'))
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('manages loading state during async execution', async () => {
    const asyncFn = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(() => resolve('data'), 10)))
    const { result } = renderHook(() => useAsyncState(asyncFn))

    expect(result.current.loading).toBe(false)

    act(() => {
      result.current.execute()
    })

    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBeNull()

    await new Promise(resolve => setTimeout(resolve, 20))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBe('data')
  })

  it('handles async function errors', async () => {
    const errorMsg = 'Network error'
    const asyncFn = vi.fn().mockRejectedValue(new Error(errorMsg))
    const { result } = renderHook(() => useAsyncState(asyncFn))

    try {
      await act(async () => {
        await result.current.execute()
      })
    } catch {
      // Expected error
    }

    expect(result.current.error).toBe(errorMsg)
    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
  })

  it('calls onSuccess callback on successful execution', async () => {
    const onSuccess = vi.fn()
    const asyncFn = vi.fn().mockResolvedValue('data')
    const { result } = renderHook(() => useAsyncState(asyncFn, { onSuccess }))

    await act(async () => {
      await result.current.execute()
    })

    expect(onSuccess).toHaveBeenCalledTimes(1)
  })

  it('calls onError callback on failed execution', async () => {
    const onError = vi.fn()
    const error = new Error('Test error')
    const asyncFn = vi.fn().mockRejectedValue(error)
    const { result } = renderHook(() => useAsyncState(asyncFn, { onError }))

    try {
      await act(async () => {
        await result.current.execute()
      })
    } catch {
      // Expected error
    }

    expect(onError).toHaveBeenCalledWith(error)
  })

  it('resets state to initial values', async () => {
    const asyncFn = vi.fn().mockResolvedValue('data')
    const { result } = renderHook(() => useAsyncState(asyncFn))

    await act(async () => {
      await result.current.execute()
    })

    expect(result.current.data).toBe('data')

    act(() => {
      result.current.reset()
    })

    expect(result.current.data).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('passes arguments to the async function', async () => {
    const asyncFn = vi.fn().mockResolvedValue('result')
    const { result } = renderHook(() => useAsyncState(asyncFn))

    await act(async () => {
      await result.current.execute('arg1', 'arg2')
    })

    expect(asyncFn).toHaveBeenCalledWith('arg1', 'arg2')
  })

  it('consolidates common loading/error/data pattern', async () => {
    interface User {
      id: string
      name: string
    }

    const fetchUser = vi.fn().mockResolvedValue({ id: '1', name: 'John' })
    const { result } = renderHook(() => useAsyncState<User, [string]>(fetchUser))

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()

    await act(async () => {
      await result.current.execute('1')
    })

    expect(result.current.data).toEqual({ id: '1', name: 'John' })
    expect(result.current.error).toBeNull()
  })
})
