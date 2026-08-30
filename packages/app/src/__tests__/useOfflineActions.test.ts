/**
 * useOfflineActions.test.ts — unit tests for useOfflineActions hook (#1260)
 *
 * Coverage for:
 *  - queueContactRequest: happy path (queued + toast), error path
 *  - queueBookmarkChange: add bookmark (POST), remove bookmark (DELETE), error path
 */

import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock offline queue ─────────────────────────────────────────────────────────

vi.mock('@/lib/offlineQueue', () => ({
  queueOfflineAction: vi.fn(),
}))

// ── Mock useToast ──────────────────────────────────────────────────────────────

const mockToast = vi.fn()
vi.mock('@/hooks/useToast', () => ({
  useToast: () => ({ toast: mockToast }),
}))

import { useOfflineActions } from '@/hooks/useOfflineActions'
import { queueOfflineAction } from '@/lib/offlineQueue'

const mockQueue = queueOfflineAction as ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// queueContactRequest
// ─────────────────────────────────────────────────────────────────────────────

describe('useOfflineActions.queueContactRequest', () => {
  it('calls queueOfflineAction with the correct arguments', async () => {
    mockQueue.mockResolvedValue('action-id-1')

    const { result } = renderHook(() => useOfflineActions())
    let returnedId: string | undefined

    await act(async () => {
      returnedId = await result.current.queueContactRequest('worker-abc', 'Hello there')
    })

    expect(mockQueue).toHaveBeenCalledWith(
      'POST',
      '/api/workers/worker-abc/contact',
      JSON.stringify({ message: 'Hello there' }),
      'contact',
    )
    expect(returnedId).toBe('action-id-1')
  })

  it('shows a success toast after queueing', async () => {
    mockQueue.mockResolvedValue('action-id-2')

    const { result } = renderHook(() => useOfflineActions())

    await act(async () => {
      await result.current.queueContactRequest('worker-xyz', 'Need help')
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' }),
    )
  })

  it('shows an error toast and re-throws when queueOfflineAction rejects', async () => {
    mockQueue.mockRejectedValue(new Error('IndexedDB unavailable'))

    const { result } = renderHook(() => useOfflineActions())

    await expect(
      act(async () => {
        await result.current.queueContactRequest('worker-err', 'Msg')
      })
    ).rejects.toThrow('IndexedDB unavailable')

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// queueBookmarkChange
// ─────────────────────────────────────────────────────────────────────────────

describe('useOfflineActions.queueBookmarkChange', () => {
  it('queues a POST when bookmarking (isBookmarked = true)', async () => {
    mockQueue.mockResolvedValue('bm-id-1')

    const { result } = renderHook(() => useOfflineActions())

    await act(async () => {
      await result.current.queueBookmarkChange('worker-bm', true)
    })

    expect(mockQueue).toHaveBeenCalledWith(
      'POST',
      '/api/workers/worker-bm/bookmark',
      expect.stringContaining('worker-bm'),
      'bookmark',
    )
  })

  it('queues a DELETE when removing bookmark (isBookmarked = false)', async () => {
    mockQueue.mockResolvedValue('bm-id-2')

    const { result } = renderHook(() => useOfflineActions())

    await act(async () => {
      await result.current.queueBookmarkChange('worker-bm', false)
    })

    expect(mockQueue).toHaveBeenCalledWith(
      'DELETE',
      '/api/workers/worker-bm/bookmark',
      undefined,
      'bookmark',
    )
  })

  it('shows success toast after bookmark queued', async () => {
    mockQueue.mockResolvedValue('bm-id-3')

    const { result } = renderHook(() => useOfflineActions())

    await act(async () => {
      await result.current.queueBookmarkChange('worker-ok', true)
    })

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'success' }),
    )
  })

  it('shows error toast and re-throws on failure', async () => {
    mockQueue.mockRejectedValue(new Error('Queue failure'))

    const { result } = renderHook(() => useOfflineActions())

    await expect(
      act(async () => {
        await result.current.queueBookmarkChange('worker-fail', true)
      })
    ).rejects.toThrow('Queue failure')

    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    )
  })
})
