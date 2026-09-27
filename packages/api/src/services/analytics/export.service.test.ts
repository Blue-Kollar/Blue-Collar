/**
 * Tests for analytics/export.service.ts — CSV/report formatting.
 *
 * Mocks DB and the worker.service dependency to keep tests isolated.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({
  db: {
    worker: { findMany: vi.fn() },
    workerAnalytics: { findMany: vi.fn() },
    review: { aggregate: vi.fn() },
  },
}))

// Mock the worker.service dependency used by exportPersonalWorkerAnalyticsCsv
vi.mock('./worker.service.js', () => ({
  getWorkerPersonalDashboard: vi.fn(),
}))

import {
  exportWorkerAnalyticsCsv,
  exportPlatformAnalyticsCsv,
  exportPersonalWorkerAnalyticsCsv,
} from './export.service.js'
import { db } from '../../db.js'
import { getWorkerPersonalDashboard } from './worker.service.js'

// ── Test fixtures ────────────────────────────────────────────────────────────

const mockWorkers = [
  {
    id: 'w1',
    name: 'Alice Smith',
    category: { name: 'Plumber' },
    curator: { firstName: 'Bob', lastName: 'Jones' },
    curatorId: 'curator1',
  },
]

const mockAnalytics = [
  { workerId: 'w1', totalViews: 100, uniqueViews: 60, totalTips: 5.5, tipCount: 3, bookmarkCount: 10, contactCount: 8 },
]

// ── exportWorkerAnalyticsCsv ─────────────────────────────────────────────────

describe('exportWorkerAnalyticsCsv', () => {
  beforeEach(() => {
    vi.mocked(db.worker.findMany).mockResolvedValue(mockWorkers as any)
    vi.mocked(db.workerAnalytics.findMany).mockResolvedValue(mockAnalytics as any)
    vi.mocked(db.review.aggregate).mockResolvedValue({ _avg: { rating: 4.5 }, _count: 12 } as any)
  })

  it('returns a string', async () => {
    const result = await exportWorkerAnalyticsCsv('curator1')
    expect(typeof result).toBe('string')
  })

  it('includes the expected CSV header row', async () => {
    const result = await exportWorkerAnalyticsCsv('curator1')
    expect(result.startsWith('Worker Name,Category,Total Views')).toBe(true)
  })

  it('includes one data row per worker', async () => {
    const result = await exportWorkerAnalyticsCsv('curator1')
    const lines = result.split('\n').filter(Boolean)
    // header + 1 worker
    expect(lines).toHaveLength(2)
  })

  it('includes the worker name in the data row', async () => {
    const result = await exportWorkerAnalyticsCsv('curator1')
    expect(result).toContain('Alice Smith')
  })

  it('returns an empty body (header only) when the curator has no workers', async () => {
    vi.mocked(db.worker.findMany).mockResolvedValue([])
    vi.mocked(db.workerAnalytics.findMany).mockResolvedValue([])
    const result = await exportWorkerAnalyticsCsv('curator1')
    const lines = result.split('\n').filter(Boolean)
    expect(lines).toHaveLength(1) // header only
  })
})

// ── exportPlatformAnalyticsCsv ───────────────────────────────────────────────

describe('exportPlatformAnalyticsCsv', () => {
  beforeEach(() => {
    vi.mocked(db.worker.findMany).mockResolvedValue(mockWorkers as any)
    vi.mocked(db.workerAnalytics.findMany).mockResolvedValue(mockAnalytics as any)
  })

  it('returns a string', async () => {
    const result = await exportPlatformAnalyticsCsv()
    expect(typeof result).toBe('string')
  })

  it('includes the Curator column in the header', async () => {
    const result = await exportPlatformAnalyticsCsv()
    expect(result).toContain('Curator')
  })

  it('includes curator name in data rows', async () => {
    const result = await exportPlatformAnalyticsCsv()
    expect(result).toContain('Bob Jones')
  })

  it('returns header only when there are no workers', async () => {
    vi.mocked(db.worker.findMany).mockResolvedValue([])
    vi.mocked(db.workerAnalytics.findMany).mockResolvedValue([])
    const result = await exportPlatformAnalyticsCsv()
    const lines = result.split('\n').filter(Boolean)
    expect(lines).toHaveLength(1)
  })
})

// ── exportPersonalWorkerAnalyticsCsv ─────────────────────────────────────────

describe('exportPersonalWorkerAnalyticsCsv', () => {
  const range = { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-07') }

  const mockDashboard = {
    worker: { id: 'w1', name: 'Alice Smith', category: 'Plumber', walletAddress: null },
    range: { startDate: '2026-01-01', endDate: '2026-01-07' },
    summary: {
      totalViews: 50,
      uniqueViews: 30,
      tipsReceived: 2.5,
      tipCount: 2,
      avgRating: 4.3,
      reviewCount: 5,
      earnings: 2.5,
      contacts: 3,
    },
    deltas: { totalViews: 10, uniqueViews: 5, tipsReceived: 0, avgRating: 0.1, earnings: 0 },
    charts: {
      series: [
        { date: '2026-01-01', views: 5, uniqueViews: 3, tips: 0, tipCount: 0, avgRating: null, reviewCount: 0, earnings: 0 },
        { date: '2026-01-02', views: 8, uniqueViews: 5, tips: 2.5, tipCount: 2, avgRating: 4.5, reviewCount: 3, earnings: 2.5 },
      ],
      ratingDistribution: [],
    },
  }

  beforeEach(() => {
    vi.mocked(getWorkerPersonalDashboard).mockResolvedValue(mockDashboard as any)
  })

  it('returns a string', async () => {
    const result = await exportPersonalWorkerAnalyticsCsv('w1', range)
    expect(typeof result).toBe('string')
  })

  it('includes the daily-series header row', async () => {
    const result = await exportPersonalWorkerAnalyticsCsv('w1', range)
    expect(result).toContain('Date,Views,Unique Views,Tips (XLM)')
  })

  it('includes one CSV row per series point', async () => {
    const result = await exportPersonalWorkerAnalyticsCsv('w1', range)
    expect(result).toContain('2026-01-01')
    expect(result).toContain('2026-01-02')
  })

  it('includes the summary section', async () => {
    const result = await exportPersonalWorkerAnalyticsCsv('w1', range)
    expect(result).toContain('Worker,Alice Smith')
    expect(result).toContain('Category,Plumber')
    expect(result).toContain('Total Views,50')
    expect(result).toContain('Tip Count,2')
  })

  it('formats tip amounts to 7 decimal places', async () => {
    const result = await exportPersonalWorkerAnalyticsCsv('w1', range)
    expect(result).toContain('2.5000000')
  })

  it('leaves avgRating blank when null', async () => {
    const result = await exportPersonalWorkerAnalyticsCsv('w1', range)
    // The first series point has avgRating: null — its cell should be empty
    const lines = result.split('\n')
    const jan1Line = lines.find((l) => l.startsWith('2026-01-01'))!
    const cols = jan1Line.split(',')
    expect(cols[5]).toBe('') // avgRating column
  })
})
