import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sonner before importing the hook
vi.mock('sonner', () => ({
  toast: Object.assign(
    vi.fn(),
    {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      loading: vi.fn().mockReturnValue('mock-toast-id'),
      dismiss: vi.fn(),
    }
  ),
}))

// Mock the error parser
vi.mock('@/lib/errors', () => ({
  parseApiError: vi.fn().mockReturnValue({
    message: 'Something went wrong',
    toastType: 'error',
    code: 500,
    retryable: false,
  }),
}))

import { useToast } from '@/hooks/useToast'
import { toast as sonnerToast } from 'sonner'

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls sonner success by default', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.toast('Saved!')
    })
    expect(sonnerToast.success).toHaveBeenCalledWith('Saved!', expect.any(Object))
  })

  it('calls the correct sonner method for each toast type', () => {
    const { result } = renderHook(() => useToast())
    const types = ['success', 'error', 'warning', 'info'] as const
    act(() => {
      types.forEach((type) => result.current.toast(`${type} message`, type))
    })
    expect(sonnerToast.success).toHaveBeenCalled()
    expect(sonnerToast.error).toHaveBeenCalled()
    expect(sonnerToast.warning).toHaveBeenCalled()
    expect(sonnerToast.info).toHaveBeenCalled()
  })

  it('calls sonner.loading for loading type and returns dismiss/update helpers', () => {
    const { result } = renderHook(() => useToast())
    let handle: ReturnType<typeof result.current.toast>
    act(() => {
      handle = result.current.toast('Loading…', 'loading')
    })
    expect(sonnerToast.loading).toHaveBeenCalledWith('Loading…', expect.any(Object))
    expect(handle).toBeDefined()
    expect(typeof handle!.dismiss).toBe('function')
    expect(typeof handle!.update).toBe('function')
  })

  it('fromApiError parses the error and calls sonner.error', () => {
    const { result } = renderHook(() => useToast())
    act(() => {
      result.current.fromApiError(new Error('fail'), 'Fallback')
    })
    expect(sonnerToast.error).toHaveBeenCalledWith(
      'Something went wrong',
      expect.any(Object)
    )
  })
})
