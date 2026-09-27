/**
 * Tests for analytics/platform.service.ts — platform-wide KPI dashboard.
 *
 * All DB access is mocked via vi.mock so no real database connection is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock DB ──────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({
  db: {
    worker: { count: vi.fn(), findMany: vi.fn() },
    user: { count: vi.fn(), findMany: vi.fn() },
    profileView: { count: vi.fn() },
    review: { count: vi.fn() },
    contactRequest: { count: vi.fn() },
    category: { findMany: vi.fn() },
    workerAnalytics: { aggregate: vi.fn() },
  },
}))

import { getPlatformAnalytics } from './platform.service.js'
import { db } from '../../db.js'

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetMocks() {
  vi.mocked(db.worker.count).mockResolvedValue(0)
  vi.mocked(db.worker.findMany).mockResolvedValue([])
  vi.mocked(db.user.count).mockResolvedValue(0)
  vi.mocked(db.user.findMany).mockResolvedValue([])
  vi.mocked(db.profileView.count).mockResolvedValue(0)
  vi.mocked(db.review.count).mockResolvedValue(0)
  vi.mocked(db.contactRequest.count).mockResolvedValue(0)
  vi.mocked(db.category.findMany).mockResolvedValue([])
  vi.mocked(db.workerAnalytics.aggregate).mockResolvedValue({
    _sum: { totalTips: 0, tipCount: 0 },
  } as any)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getPlatformAnalytics', () => {
  beforeEach(() => {
    resetMocks()
  })

  it('returns the expected top-level keys', async () => {
    const result = await getPlatformAnalytics()
    expect(result).toHaveProperty('overview')
    expect(result).toHaveProperty('engagement')
    expect(result).toHaveProperty('revenue')
    expect(result).toHaveProperty('growth')
    expect(result).toHaveProperty('trends')
    expect(result).toHaveProperty('topCategories')
    expect(result).toHaveProperty('recentWorkers')
    expect(result).toHaveProperty('recentUsers')
  })

  it('reflects worker and user counts in the overview', async () => {
    vi.mocked(db.worker.count)
      .mockResolvedValueOnce(50)  // totalWorkers
      .mockResolvedValueOnce(40)  // activeWorkers
      .mockResolvedValueOnce(5)   // workersThisMonth
      .mockResolvedValueOnce(3)   // workersLastMonth

    vi.mocked(db.user.count)
      .mockResolvedValueOnce(200) // totalUsers
      .mockResolvedValueOnce(10)  // totalCurators
      .mockResolvedValueOnce(20)  // usersThisMonth
      .mockResolvedValueOnce(15)  // usersLastMonth
      // Remaining 6-month growth calls resolve to 0 via resetMocks default

    const result = await getPlatformAnalytics()
    expect(result.overview.totalWorkers).toBe(50)
    expect(result.overview.activeWorkers).toBe(40)
    expect(result.overview.totalUsers).toBe(200)
    expect(result.overview.totalCurators).toBe(10)
  })

  it('calculates growth percentages correctly', async () => {
    // Set workersThisMonth=10, workersLastMonth=8 → workerGrowthPct=25
    vi.mocked(db.worker.count)
      .mockResolvedValueOnce(100) // totalWorkers
      .mockResolvedValueOnce(80)  // activeWorkers
      .mockResolvedValueOnce(10)  // workersThisMonth
      .mockResolvedValueOnce(8)   // workersLastMonth

    vi.mocked(db.user.count)
      .mockResolvedValueOnce(500) // totalUsers
      .mockResolvedValueOnce(25)  // totalCurators
      .mockResolvedValueOnce(50)  // usersThisMonth
      .mockResolvedValueOnce(50)  // usersLastMonth → 0% growth

    const result = await getPlatformAnalytics()
    expect(result.growth.workerGrowthPct).toBe(25)
    expect(result.growth.userGrowthPct).toBe(0)
  })

  it('surfaces revenue totals from the analytics aggregate', async () => {
    vi.mocked(db.workerAnalytics.aggregate).mockResolvedValue({
      _sum: { totalTips: 123.456789, tipCount: 42 },
    } as any)

    const result = await getPlatformAnalytics()
    expect(result.revenue.totalTips).toBe(123.456789)
    expect(result.revenue.totalTipCount).toBe(42)
  })

  it('maps top categories to name + count shape', async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([
      { id: 'c1', name: 'Plumber', _count: { workers: 15 } } as any,
      { id: 'c2', name: 'Electrician', _count: { workers: 12 } } as any,
    ])

    const result = await getPlatformAnalytics()
    expect(result.topCategories).toEqual([
      { name: 'Plumber', count: 15 },
      { name: 'Electrician', count: 12 },
    ])
  })

  it('returns empty arrays when there are no workers or users', async () => {
    const result = await getPlatformAnalytics()
    expect(result.recentWorkers).toEqual([])
    expect(result.recentUsers).toEqual([])
    expect(result.topCategories).toEqual([])
  })

  it('trends contain userGrowth and workerGrowth arrays', async () => {
    const result = await getPlatformAnalytics()
    expect(Array.isArray(result.trends.userGrowth)).toBe(true)
    expect(Array.isArray(result.trends.workerGrowth)).toBe(true)
  })
})
