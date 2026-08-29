/**
 * useNetworkMonitor hook unit tests (#1040)
 *
 * Covers:
 * - Subscribes to NetInfo on mount, unsubscribes on unmount
 * - Calls cacheStore.setNetworkState with the current network state
 * - Calls onReconnect callback when transitioning offline → online
 * - Calls onDisconnect callback when transitioning online → offline
 * - Sets sync status to "offline" on disconnect
 * - Triggers queue processing on reconnect when autoSyncOnReconnect=true
 * - Does NOT auto-process queue when autoSyncOnReconnect=false
 * - Returns correct isOffline / syncStatus / pendingActionsCount values
 */
import { renderHook, act } from '@testing-library/react-native'

// ── Mock dependencies ────────────────────────────────────────────────────────
jest.mock('@react-native-community/netinfo', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(),
    fetch: jest.fn(),
  },
}))

jest.mock('../CacheStore', () => ({
  cacheStore: {
    setNetworkState: jest.fn(),
    setSyncStatus: jest.fn(),
    getSyncStatus: jest.fn().mockReturnValue('idle'),
    isOffline: jest.fn().mockReturnValue(false),
    getPendingActionsCount: jest.fn().mockReturnValue(0),
    processQueue: jest.fn().mockResolvedValue(undefined),
  },
}))

import NetInfo from '@react-native-community/netinfo'
import { cacheStore } from '../CacheStore'
import { useNetworkMonitor } from '../NetworkMonitor'

const netInfoMock = NetInfo as jest.Mocked<typeof NetInfo>
const cacheMock = cacheStore as jest.Mocked<typeof cacheStore>

function makeNetInfoState(connected: boolean, reachable: boolean | null = null) {
  return {
    isConnected: connected,
    isInternetReachable: reachable,
    type: 'wifi',
    details: null,
  }
}

describe('useNetworkMonitor', () => {
  let listenerCallback: (state: any) => void = () => {}
  let unsubscribeSpy: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    unsubscribeSpy = jest.fn()
    ;(netInfoMock.addEventListener as jest.Mock).mockImplementation((cb: any) => {
      listenerCallback = cb
      return unsubscribeSpy
    })
    ;(netInfoMock.fetch as jest.Mock).mockResolvedValue(makeNetInfoState(true))
    cacheMock.isOffline.mockReturnValue(false)
    cacheMock.getSyncStatus.mockReturnValue('idle')
    cacheMock.getPendingActionsCount.mockReturnValue(0)
  })

  it('subscribes to NetInfo on mount', () => {
    renderHook(() => useNetworkMonitor())
    expect(netInfoMock.addEventListener).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes from NetInfo on unmount', () => {
    const { unmount } = renderHook(() => useNetworkMonitor())
    unmount()
    expect(unsubscribeSpy).toHaveBeenCalledTimes(1)
  })

  it('calls cacheStore.setNetworkState with current state on initial fetch', async () => {
    ;(netInfoMock.fetch as jest.Mock).mockResolvedValue(makeNetInfoState(true, true))
    renderHook(() => useNetworkMonitor())
    await act(async () => {})
    expect(cacheMock.setNetworkState).toHaveBeenCalledWith(
      expect.objectContaining({ isConnected: true, isInternetReachable: true })
    )
  })

  it('calls onReconnect when network transitions from offline to online', async () => {
    const onReconnect = jest.fn()
    renderHook(() => useNetworkMonitor({ onReconnect }))

    // Simulate initial offline state
    await act(async () => {
      listenerCallback(makeNetInfoState(false))
    })

    // Simulate reconnect
    await act(async () => {
      listenerCallback(makeNetInfoState(true))
    })

    expect(onReconnect).toHaveBeenCalled()
  })

  it('does not call onReconnect on the very first network event (initial mount)', async () => {
    const onReconnect = jest.fn()
    renderHook(() => useNetworkMonitor({ onReconnect }))

    await act(async () => {
      listenerCallback(makeNetInfoState(true))
    })

    expect(onReconnect).not.toHaveBeenCalled()
  })

  it('calls onDisconnect when network goes offline', async () => {
    const onDisconnect = jest.fn()
    renderHook(() => useNetworkMonitor({ onDisconnect }))

    // Pass through initial mount event
    await act(async () => {
      listenerCallback(makeNetInfoState(true))
    })

    // Go offline
    await act(async () => {
      listenerCallback(makeNetInfoState(false))
    })

    expect(onDisconnect).toHaveBeenCalled()
  })

  it('sets sync status to "offline" when disconnecting', async () => {
    renderHook(() => useNetworkMonitor())

    await act(async () => {
      listenerCallback(makeNetInfoState(true)) // initial
    })

    await act(async () => {
      listenerCallback(makeNetInfoState(false)) // disconnect
    })

    expect(cacheMock.setSyncStatus).toHaveBeenCalledWith('offline')
  })

  it('processes the queue on reconnect when autoSyncOnReconnect=true (default)', async () => {
    renderHook(() => useNetworkMonitor({ autoSyncOnReconnect: true }))

    await act(async () => {
      listenerCallback(makeNetInfoState(false)) // initial offline
    })

    await act(async () => {
      listenerCallback(makeNetInfoState(true)) // reconnect
    })

    expect(cacheMock.processQueue).toHaveBeenCalled()
  })

  it('does NOT process queue on reconnect when autoSyncOnReconnect=false', async () => {
    const onReconnect = jest.fn()
    renderHook(() => useNetworkMonitor({ autoSyncOnReconnect: false, onReconnect }))

    await act(async () => {
      listenerCallback(makeNetInfoState(false))
    })

    await act(async () => {
      listenerCallback(makeNetInfoState(true))
    })

    expect(cacheMock.processQueue).not.toHaveBeenCalled()
    expect(onReconnect).toHaveBeenCalled()
  })

  it('returns the current isOffline, syncStatus, and pendingActionsCount from cacheStore', () => {
    cacheMock.isOffline.mockReturnValue(true)
    cacheMock.getSyncStatus.mockReturnValue('error')
    cacheMock.getPendingActionsCount.mockReturnValue(3)

    const { result } = renderHook(() => useNetworkMonitor())
    expect(result.current.isOffline).toBe(true)
    expect(result.current.syncStatus).toBe('error')
    expect(result.current.pendingActionsCount).toBe(3)
  })
})
