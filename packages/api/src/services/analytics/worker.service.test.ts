/**
 * Tests for analytics/worker.service.ts — per-worker engagement metrics.
 *
 * All DB access is mocked via vi.mock.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock DB ──────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({
  db: {
    worker: { findUnique: vi.fn(), findMany: vi.fn() },
    workerAnalytics: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn() },
    workerTipEvent: { create: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
    profileView: { findFirst: vi.fn(), create: vi.fn(), findMany: vi.fn(), count: vi.fn(), groupBy: vi.fn() },
    review: { aggregate: vi.fn(), groupBy: vi.fn(), findMany: vi.fn() },
    contactRequest: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}))

import {
  assertCanAccessWorkerAnalytics,
  parseAnalyticsDateRange,
  recordProfileView,
  recordTip,
  updateBookmarkCount,
  recordContact,
  getWorkerAnalytics,
  getCuratorAnalytics,
  getWorkerViewTrends,
  getWorkerPersonalDashboard,
  getWorkerDashboardSeries,
  getTopWorkers,
} from './worker.service.js'
import { db } from '../../db.js'

// ── assertCanAccessWorkerAnalytics ───────────────────────────────────────────

describe('assertCanAccessWorkerAnalytics', () => {
  it('throws 404 when worker does not exist', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null)
    await expect(assertCanAccessWorkerAnalytics('w1', 'u1', 'curator')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('throws 403 when curator does not own the worker', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1', curatorId: 'other' } as any)
    await expect(assertCanAccessWorkerAnalytics('w1', 'u1', 'curator')).rejects.toMatchObject({
      statusCode: 403,
    })
  })

  it('allows access when curator owns the worker', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1', curatorId: 'u1' } as any)
    await expect(assertCanAccessWorkerAnalytics('w1', 'u1', 'curator')).resolves.toBeTruthy()
  })

  it('allows access for admin regardless of curator ownership', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1', curatorId: 'other' } as any)
    await expect(assertCanAccessWorkerAnalytics('w1', 'admin-id', 'admin')).resolves.toBeTruthy()
  })
})

// ── parseAnalyticsDateRange ──────────────────────────────────────────────────

describe('parseAnalyticsDateRange', () => {
  it('defaults to last 30 days when no params provided', () => {
    const range = parseAnalyticsDateRange({})
    const diffMs = range.endDate.getTime() - range.startDate.getTime()
    const diffDays = diffMs / (1000 * 60 * 60 * 24)
    // startDate is floored to UTC midnight 29 days before endDate (which is `now`).
    // Because `now` carries a time component the diff is between 29 and 30 days.
    expect(diffDays).toBeGreaterThanOrEqual(29)
    expect(diffDays).toBeLessThan(30)
  })

  it('respects an explicit startDate and endDate', () => {
    const range = parseAnalyticsDateRange({ startDate: '2026-01-01', endDate: '2026-01-31' })
    expect(range.startDate.toISOString().slice(0, 10)).toBe('2026-01-01')
    expect(range.endDate.toISOString().slice(0, 10)).toBe('2026-01-31')
  })

  it('throws when startDate is after endDate', () => {
    expect(() =>
      parseAnalyticsDateRange({ startDate: '2026-06-01', endDate: '2026-01-01' }),
    ).toThrow()
  })

  it('throws when range exceeds 366 days', () => {
    expect(() =>
      parseAnalyticsDateRange({ startDate: '2025-01-01', endDate: '2026-06-01' }),
    ).toThrow()
  })

  it('throws on an invalid startDate', () => {
    expect(() => parseAnalyticsDateRange({ startDate: 'not-a-date' })).toThrow()
  })
})

// ── recordProfileView ────────────────────────────────────────────────────────

describe('recordProfileView', () => {
  beforeEach(() => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.profileView.findFirst).mockResolvedValue(null)
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValue({} as any)
    vi.mocked(db.profileView.create).mockResolvedValue({} as any)
  })

  it('throws 404 when worker does not exist', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null)
    await expect(recordProfileView('w1', '1.2.3.4')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('upserts workerAnalytics when recording a view', async () => {
    await recordProfileView('w1', '1.2.3.4')
    expect(db.workerAnalytics.upsert).toHaveBeenCalledOnce()
  })

  it('creates a new profileView record for a new IP', async () => {
    await recordProfileView('w1', '1.2.3.4')
    expect(db.profileView.create).toHaveBeenCalledOnce()
  })

  it('does not create a new profileView for a duplicate IP on the same day', async () => {
    vi.mocked(db.profileView.findFirst).mockResolvedValue({ id: 'pv1' } as any)
    await recordProfileView('w1', '1.2.3.4')
    expect(db.profileView.create).not.toHaveBeenCalled()
  })
})

// ── recordTip ────────────────────────────────────────────────────────────────

describe('recordTip', () => {
  beforeEach(() => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.$transaction).mockResolvedValue([{}, {}] as any)
  })

  it('throws 404 when worker does not exist', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null)
    await expect(recordTip('w1', 10)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 400 for zero amount', async () => {
    await expect(recordTip('w1', 0)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 for negative amount', async () => {
    await expect(recordTip('w1', -5)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('throws 400 for NaN amount', async () => {
    await expect(recordTip('w1', NaN)).rejects.toMatchObject({ statusCode: 400 })
  })

  it('executes a transaction for valid tip', async () => {
    await recordTip('w1', 10.5, 'tx123')
    expect(db.$transaction).toHaveBeenCalledOnce()
  })
})

// ── updateBookmarkCount ──────────────────────────────────────────────────────

describe('updateBookmarkCount', () => {
  it('calls workerAnalytics.upsert with +1 delta', async () => {
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValue({} as any)
    await updateBookmarkCount('w1', 1)
    expect(db.workerAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ bookmarkCount: { increment: 1 } }) }),
    )
  })

  it('calls workerAnalytics.upsert with -1 delta', async () => {
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValue({} as any)
    await updateBookmarkCount('w1', -1)
    expect(db.workerAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ bookmarkCount: { increment: -1 } }) }),
    )
  })
})

// ── recordContact ────────────────────────────────────────────────────────────

describe('recordContact', () => {
  it('increments contactCount via upsert', async () => {
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValue({} as any)
    await recordContact('w1')
    expect(db.workerAnalytics.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { contactCount: { increment: 1 } } }),
    )
  })
})

// ── getWorkerAnalytics ───────────────────────────────────────────────────────

describe('getWorkerAnalytics', () => {
  beforeEach(() => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({
      id: 'w1',
      name: 'Alice',
      category: { name: 'Plumber' },
    } as any)
    vi.mocked(db.workerAnalytics.findUnique).mockResolvedValue({
      totalViews: 100,
      uniqueViews: 60,
      totalTips: 5.5,
      tipCount: 3,
      bookmarkCount: 10,
      contactCount: 8,
      updatedAt: new Date(),
    } as any)
    vi.mocked(db.review.aggregate).mockResolvedValue({ _avg: { rating: 4.5 }, _count: 12 } as any)
    vi.mocked(db.profileView.groupBy).mockResolvedValue([{ _count: 20 }] as any)
    vi.mocked(db.contactRequest.count).mockResolvedValue(5)
  })

  it('throws 404 when worker not found', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null)
    await expect(getWorkerAnalytics('w1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns analytics data for a known worker', async () => {
    const result = await getWorkerAnalytics('w1')
    expect(result.workerName).toBe('Alice')
    expect(result.category).toBe('Plumber')
    expect(result.totalViews).toBe(100)
    expect(result.avgRating).toBe(4.5)
    expect(result.reviewCount).toBe(12)
  })

  it('defaults to zeros when no analytics row exists', async () => {
    vi.mocked(db.workerAnalytics.findUnique).mockResolvedValue(null)
    const result = await getWorkerAnalytics('w1')
    expect(result.totalViews).toBe(0)
    expect(result.totalTips).toBe(0)
    expect(result.bookmarkCount).toBe(0)
  })
})

// ── getCuratorAnalytics ──────────────────────────────────────────────────────

describe('getCuratorAnalytics', () => {
  it('returns zeroed totals when curator has no workers', async () => {
    vi.mocked(db.worker.findMany).mockResolvedValue([])
    const result = await getCuratorAnalytics('curator1')
    expect(result.totalWorkers).toBe(0)
    expect(result.workers).toHaveLength(0)
  })

  it('returns correct totals when workers exist', async () => {
    vi.mocked(db.worker.findMany).mockResolvedValue([
      { id: 'w1', name: 'Alice', isActive: true, category: { name: 'Plumber' } },
      { id: 'w2', name: 'Bob', isActive: false, category: { name: 'Electrician' } },
    ] as any)
    vi.mocked(db.workerAnalytics.findMany).mockResolvedValue([
      { workerId: 'w1', totalViews: 10, uniqueViews: 8, totalTips: 2, tipCount: 1, bookmarkCount: 3, contactCount: 2 },
      { workerId: 'w2', totalViews: 5, uniqueViews: 3, totalTips: 0, tipCount: 0, bookmarkCount: 1, contactCount: 0 },
    ] as any)
    vi.mocked(db.review.aggregate).mockResolvedValue({ _avg: { rating: 4.0 }, _count: 5 } as any)
    vi.mocked(db.contactRequest.count).mockResolvedValue(3)
    vi.mocked(db.profileView.count).mockResolvedValue(7)

    const result = await getCuratorAnalytics('curator1')
    expect(result.totalWorkers).toBe(2)
    expect(result.activeWorkers).toBe(1)
    expect(result.totals.views).toBe(15)
    expect(result.totals.tips).toBe(2)
  })
})

// ── getWorkerViewTrends ──────────────────────────────────────────────────────

describe('getWorkerViewTrends', () => {
  it('throws 404 when worker not found', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null)
    await expect(getWorkerViewTrends('w1')).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns one entry per requested day', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.profileView.findMany).mockResolvedValue([])
    const result = await getWorkerViewTrends('w1', 7)
    expect(result).toHaveLength(7)
    expect(result[0]).toHaveProperty('date')
    expect(result[0]).toHaveProperty('views')
  })

  it('aggregates view counts by date', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1' } as any)
    const today = new Date()
    today.setUTCHours(12, 0, 0, 0)
    vi.mocked(db.profileView.findMany).mockResolvedValue([{ viewedAt: today }, { viewedAt: today }] as any)
    const result = await getWorkerViewTrends('w1', 7)
    const todayKey = today.toISOString().slice(0, 10)
    const todayEntry = result.find((r) => r.date === todayKey)
    expect(todayEntry?.views).toBe(2)
  })
})

// ── getTopWorkers ────────────────────────────────────────────────────────────

describe('getTopWorkers', () => {
  it('returns ranked worker entries', async () => {
    vi.mocked(db.workerAnalytics.findMany).mockResolvedValue([
      {
        workerId: 'w1',
        totalViews: 500,
        totalTips: 10,
        bookmarkCount: 20,
        avgRating: 4.8,
        worker: { name: 'Alice', category: { name: 'Plumber' } },
      },
    ] as any)

    const result = await getTopWorkers('views', 1)
    expect(result).toHaveLength(1)
    expect(result[0].rank).toBe(1)
    expect(result[0].workerName).toBe('Alice')
    expect(result[0].totalViews).toBe(500)
  })
})

// ── getWorkerDashboardSeries ─────────────────────────────────────────────────

describe('getWorkerDashboardSeries', () => {
  it('throws 404 when worker not found', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null)
    const range = { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-07') }
    await expect(getWorkerDashboardSeries('w1', range)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('returns one point per day in the range', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.profileView.findMany).mockResolvedValue([])
    vi.mocked(db.workerTipEvent.findMany).mockResolvedValue([])
    vi.mocked(db.review.findMany).mockResolvedValue([])

    const range = { startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-01-05T23:59:59Z') }
    const result = await getWorkerDashboardSeries('w1', range)
    expect(result).toHaveLength(5)
  })

  it('aggregates views and tips into daily points', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'w1' } as any)
    vi.mocked(db.profileView.findMany).mockResolvedValue([
      { viewedAt: new Date('2026-01-03T10:00:00Z'), ip: '1.2.3.4' },
      { viewedAt: new Date('2026-01-03T11:00:00Z'), ip: '1.2.3.5' },
    ] as any)
    vi.mocked(db.workerTipEvent.findMany).mockResolvedValue([
      { amount: 5.0, createdAt: new Date('2026-01-03T12:00:00Z') },
    ] as any)
    vi.mocked(db.review.findMany).mockResolvedValue([])

    const range = { startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-01-05T23:59:59Z') }
    const result = await getWorkerDashboardSeries('w1', range)
    const jan3 = result.find((p) => p.date === '2026-01-03')!
    expect(jan3.views).toBe(2)
    expect(jan3.uniqueViews).toBe(2)
    expect(jan3.tips).toBe(5.0)
    expect(jan3.tipCount).toBe(1)
  })
})
