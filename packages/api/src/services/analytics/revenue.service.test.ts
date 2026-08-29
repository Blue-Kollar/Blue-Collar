/**
 * Tests for analytics/revenue.service.ts — fee/tip/escrow revenue aggregation.
 *
 * revenue.service.ts is a thin re-export of two repository functions, so these
 * tests verify that the exported symbols are callable with the correct shape.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock DB ──────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({
  db: {
    user: { count: vi.fn() },
    worker: { count: vi.fn() },
    review: { count: vi.fn() },
    profileView: { count: vi.fn() },
    contactRequest: { count: vi.fn() },
    bookmark: { count: vi.fn() },
    workerAnalytics: { aggregate: vi.fn() },
    dispute: { count: vi.fn() },
  },
}))

import { getRevenueMetrics, getDisputeMetrics } from './revenue.service.js'
import { db } from '../../db.js'

// ── getRevenueMetrics ────────────────────────────────────────────────────────

describe('getRevenueMetrics', () => {
  beforeEach(() => {
    vi.mocked(db.workerAnalytics.aggregate).mockResolvedValue({
      _sum: { totalTips: 250.5, tipCount: 30 },
    } as any)
  })

  it('returns totalRevenue and totalTransactions', async () => {
    const result = await getRevenueMetrics()
    expect(result).toHaveProperty('totalRevenue')
    expect(result).toHaveProperty('totalTransactions')
  })

  it('returns correct values from the aggregate', async () => {
    const result = await getRevenueMetrics()
    expect(result.totalRevenue).toBe(250.5)
    expect(result.totalTransactions).toBe(30)
  })

  it('returns zeros when aggregate sums are null', async () => {
    vi.mocked(db.workerAnalytics.aggregate).mockResolvedValue({
      _sum: { totalTips: null, tipCount: null },
    } as any)
    const result = await getRevenueMetrics()
    expect(result.totalRevenue).toBe(0)
    expect(result.totalTransactions).toBe(0)
  })

  it('accepts an optional date range filter', async () => {
    const filter = { startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31') }
    const result = await getRevenueMetrics(filter)
    expect(result).toHaveProperty('totalRevenue')
    expect(db.workerAnalytics.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.anything() }),
    )
  })
})

// ── getDisputeMetrics ────────────────────────────────────────────────────────

describe('getDisputeMetrics', () => {
  beforeEach(() => {
    vi.mocked(db.dispute.count)
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(7)  // resolved
      .mockResolvedValueOnce(3)  // pending
  })

  it('returns total, resolved, pending, and resolutionRate', async () => {
    const result = await getDisputeMetrics()
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('resolved')
    expect(result).toHaveProperty('pending')
    expect(result).toHaveProperty('resolutionRate')
  })

  it('calculates resolutionRate as a percentage', async () => {
    const result = await getDisputeMetrics()
    expect(result.total).toBe(10)
    expect(result.resolved).toBe(7)
    expect(result.resolutionRate).toBe(70)
  })

  it('returns resolutionRate of 0 when there are no disputes', async () => {
    vi.mocked(db.dispute.count).mockReset()
    vi.mocked(db.dispute.count)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
    const result = await getDisputeMetrics()
    expect(result.resolutionRate).toBe(0)
  })
})
