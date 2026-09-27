/**
 * OfflineBanner unit tests (#1040)
 *
 * Covers all visual states:
 * - Online + idle + no pending → renders nothing
 * - Offline → shows red "You're offline" banner
 * - Syncing → shows teal "Syncing N action(s)..." with spinner
 * - Sync error → shows red error banner
 * - Pending actions (online, not syncing) → shows yellow queued banner
 * - Pluralisation of "action" vs "actions"
 */
import React from 'react'
import { render } from '@testing-library/react-native'

// Mock the NetworkMonitor hook so we control banner state precisely
jest.mock('../NetworkMonitor', () => ({
  useNetworkMonitor: jest.fn(),
}))

const { useNetworkMonitor } = require('../NetworkMonitor')

type BannerState = {
  isOffline: boolean
  syncStatus: 'idle' | 'syncing' | 'error' | 'offline'
  pendingActionsCount: number
}

function setupMonitor(state: Partial<BannerState> = {}) {
  ;(useNetworkMonitor as jest.Mock).mockReturnValue({
    isOffline: false,
    syncStatus: 'idle',
    pendingActionsCount: 0,
    ...state,
  })
}

import { OfflineBanner } from '../OfflineBanner'

describe('OfflineBanner', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders nothing when online, idle, and no pending actions', () => {
    setupMonitor()
    const { toJSON } = render(<OfflineBanner />)
    expect(toJSON()).toBeNull()
  })

  // ─── Offline state ────────────────────────────────────────────────────────
  it('shows "offline" banner with red background when offline', () => {
    setupMonitor({ isOffline: true })
    const { getByText } = render(<OfflineBanner />)
    expect(getByText(/You're offline/i)).toBeTruthy()
  })

  it('banner background is red (#FF6B6B) when offline', () => {
    setupMonitor({ isOffline: true })
    const { UNSAFE_root } = render(<OfflineBanner />)
    const banner = UNSAFE_root.findAllByType(require('react-native').View)[0]
    expect(banner.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#FF6B6B' })])
    )
  })

  // ─── Syncing state ────────────────────────────────────────────────────────
  it('shows syncing banner with action count (singular)', () => {
    setupMonitor({ isOffline: false, syncStatus: 'syncing', pendingActionsCount: 1 })
    const { getByText } = render(<OfflineBanner />)
    expect(getByText(/Syncing 1 action\.\.\./i)).toBeTruthy()
  })

  it('shows syncing banner with action count (plural)', () => {
    setupMonitor({ isOffline: false, syncStatus: 'syncing', pendingActionsCount: 3 })
    const { getByText } = render(<OfflineBanner />)
    expect(getByText(/Syncing 3 actions\.\.\./i)).toBeTruthy()
  })

  it('shows ActivityIndicator spinner when syncing', () => {
    setupMonitor({ isOffline: false, syncStatus: 'syncing', pendingActionsCount: 2 })
    const { UNSAFE_getAllByType } = render(<OfflineBanner />)
    const ActivityIndicator = require('react-native').ActivityIndicator
    expect(UNSAFE_getAllByType(ActivityIndicator).length).toBeGreaterThan(0)
  })

  // ─── Sync error state ─────────────────────────────────────────────────────
  it('shows sync-failed banner with action count (singular)', () => {
    setupMonitor({ isOffline: false, syncStatus: 'error', pendingActionsCount: 1 })
    const { getByText } = render(<OfflineBanner />)
    expect(getByText(/Sync failed for 1 action/i)).toBeTruthy()
  })

  it('shows sync-failed banner with action count (plural)', () => {
    setupMonitor({ isOffline: false, syncStatus: 'error', pendingActionsCount: 4 })
    const { getByText } = render(<OfflineBanner />)
    expect(getByText(/Sync failed for 4 actions/i)).toBeTruthy()
  })

  it('does not show spinner when sync has errored', () => {
    setupMonitor({ isOffline: false, syncStatus: 'error', pendingActionsCount: 1 })
    const { UNSAFE_queryAllByType } = render(<OfflineBanner />)
    const ActivityIndicator = require('react-native').ActivityIndicator
    expect(UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0)
  })

  // ─── Pending but online ───────────────────────────────────────────────────
  it('shows queued banner (singular) when actions are pending but not syncing', () => {
    setupMonitor({ isOffline: false, syncStatus: 'idle', pendingActionsCount: 1 })
    const { getByText } = render(<OfflineBanner />)
    expect(getByText(/1 action queued/i)).toBeTruthy()
  })

  it('shows queued banner (plural) when multiple actions are pending', () => {
    setupMonitor({ isOffline: false, syncStatus: 'idle', pendingActionsCount: 5 })
    const { getByText } = render(<OfflineBanner />)
    expect(getByText(/5 actions queued/i)).toBeTruthy()
  })

  it('queued banner has yellow background (#FFE66D)', () => {
    setupMonitor({ isOffline: false, syncStatus: 'idle', pendingActionsCount: 2 })
    const { UNSAFE_root } = render(<OfflineBanner />)
    const banner = UNSAFE_root.findAllByType(require('react-native').View)[0]
    expect(banner.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ backgroundColor: '#FFE66D' })])
    )
  })
})
