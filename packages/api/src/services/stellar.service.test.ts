/**
 * stellar.service.test.ts — unit tests for stellar service (#1370)
 *
 * Coverage for:
 *  - registerOnChain: worker validation, contract ID assignment
 *  - syncReputationToDb: worker validation, reputation sync and basis points conversion
 *  - getWorkerReputation: worker validation, reputation summary retrieval
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerOnChain, syncReputationToDb, getWorkerReputation } from './stellar.service.js'
import { AppError } from '../utils/AppError.js'

// ── DB mock ────────────────────────────────────────────────────────────────────

vi.mock('../db.js', () => ({
  db: {
    worker: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workerAnalytics: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}))

import { db } from '../db.js'

// ── Test fixtures ──────────────────────────────────────────────────────────────

const mockWorker = {
  id: 'worker-1',
  name: 'John Doe',
  isVerified: true,
  stellarContractId: 'contract-123',
  category: { id: 'cat-1', name: 'Plumbing' },
  curator: { id: 'curator-1', name: 'Alice' },
}

const mockAnalytics = {
  workerId: 'worker-1',
  avgRating: 85.5,
  reviewCount: 42,
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// registerOnChain tests

describe('registerOnChain', () => {
  it('throws when worker does not exist', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(null)

    await expect(registerOnChain('nonexistent-worker', 'contract-abc')).rejects.toThrow(AppError)
    expect(vi.mocked(db.worker.findUnique)).toHaveBeenCalledWith({
      where: { id: 'nonexistent-worker' },
    })
  })

  it('registers worker on-chain with valid ID', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(mockWorker)
    vi.mocked(db.worker.update).mockResolvedValueOnce({ ...mockWorker, stellarContractId: 'new-contract-456' })

    const result = await registerOnChain('worker-1', 'new-contract-456')

    expect(result.stellarContractId).toBe('new-contract-456')
    expect(vi.mocked(db.worker.update)).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      data: { stellarContractId: 'new-contract-456' },
      include: { category: true, curator: true },
    })
  })

  it('includes category and curator in response', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(mockWorker)
    vi.mocked(db.worker.update).mockResolvedValueOnce(mockWorker)

    const result = await registerOnChain('worker-1', 'contract-123')

    expect(result.category).toBeDefined()
    expect(result.curator).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// syncReputationToDb tests

describe('syncReputationToDb', () => {
  it('throws when worker does not exist', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(null)

    await expect(syncReputationToDb('nonexistent-worker', 8550, 42, 7200)).rejects.toThrow(AppError)
  })

  it('syncs reputation with basis points conversion', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(mockWorker)
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValueOnce(mockAnalytics)
    vi.mocked(db.worker.update).mockResolvedValueOnce(mockWorker)

    const avgRatingBps = 8550 // 85.50 on 0-100 scale
    const reviewCount = 42
    const reputation = 7200

    const result = await syncReputationToDb('worker-1', avgRatingBps, reviewCount, reputation)

    expect(vi.mocked(db.workerAnalytics.upsert)).toHaveBeenCalledWith({
      where: { workerId: 'worker-1' },
      update: {
        avgRating: 85.5, // converted from 8550 bps
        reviewCount: 42,
      },
      create: {
        workerId: 'worker-1',
        avgRating: 85.5,
        reviewCount: 42,
      },
    })
  })

  it('creates new analytics record when none exists', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(mockWorker)
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValueOnce(mockAnalytics)
    vi.mocked(db.worker.update).mockResolvedValueOnce(mockWorker)

    await syncReputationToDb('worker-1', 9000, 50, 8000)

    const upsertCall = vi.mocked(db.workerAnalytics.upsert).mock.calls[0][0]
    expect(upsertCall.create).toBeDefined()
    expect(upsertCall.create?.avgRating).toBe(90) // 9000 / 100
  })

  it('updates existing analytics record', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(mockWorker)
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValueOnce(mockAnalytics)
    vi.mocked(db.worker.update).mockResolvedValueOnce(mockWorker)

    await syncReputationToDb('worker-1', 9000, 50, 8000)

    const upsertCall = vi.mocked(db.workerAnalytics.upsert).mock.calls[0][0]
    expect(upsertCall.update).toBeDefined()
    expect(upsertCall.update?.avgRating).toBe(90)
    expect(upsertCall.update?.reviewCount).toBe(50)
  })

  it('converts basis points to 0-100 scale correctly', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(mockWorker)
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValueOnce(mockAnalytics)
    vi.mocked(db.worker.update).mockResolvedValueOnce(mockWorker)

    const testCases = [
      { bps: 0, expected: 0 },
      { bps: 10000, expected: 100 },
      { bps: 5000, expected: 50 },
      { bps: 8550, expected: 85.5 },
    ]

    for (const { bps, expected } of testCases) {
      vi.clearAllMocks()
      vi.mocked(db.worker.findUnique).mockResolvedValueOnce(mockWorker)
      vi.mocked(db.workerAnalytics.upsert).mockResolvedValueOnce(mockAnalytics)
      vi.mocked(db.worker.update).mockResolvedValueOnce(mockWorker)

      await syncReputationToDb('worker-1', bps, 10, 5000)

      const upsertCall = vi.mocked(db.workerAnalytics.upsert).mock.calls[0][0]
      expect(upsertCall.update?.avgRating).toBe(expected)
    }
  })

  it('returns updated worker with category and curator', async () => {
    const updatedWorker = { ...mockWorker, stellarContractId: 'contract-123' }
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(mockWorker)
    vi.mocked(db.workerAnalytics.upsert).mockResolvedValueOnce(mockAnalytics)
    vi.mocked(db.worker.update).mockResolvedValueOnce(updatedWorker)

    const result = await syncReputationToDb('worker-1', 8550, 42, 7200)

    expect(result.id).toBe('worker-1')
    expect(result.category).toBeDefined()
    expect(result.curator).toBeDefined()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getWorkerReputation tests

describe('getWorkerReputation', () => {
  it('throws when worker does not exist', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(null)

    await expect(getWorkerReputation('nonexistent-worker')).rejects.toThrow(AppError)
  })

  it('retrieves reputation summary for existing worker', async () => {
    const workerData = { id: 'worker-1', isVerified: true, stellarContractId: 'contract-123' }
    const analyticsData = { avgRating: 85.5, reviewCount: 42 }

    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(workerData)
    vi.mocked(db.workerAnalytics.findUnique).mockResolvedValueOnce(analyticsData)

    const result = await getWorkerReputation('worker-1')

    expect(result.workerId).toBe('worker-1')
    expect(result.isVerified).toBe(true)
    expect(result.stellarContractId).toBe('contract-123')
    expect(result.avgRating).toBe(85.5)
    expect(result.reviewCount).toBe(42)
  })

  it('returns null for stellarContractId when not set', async () => {
    const workerData = { id: 'worker-1', isVerified: true, stellarContractId: null }
    const analyticsData = { avgRating: 85.5, reviewCount: 42 }

    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(workerData)
    vi.mocked(db.workerAnalytics.findUnique).mockResolvedValueOnce(analyticsData)

    const result = await getWorkerReputation('worker-1')

    expect(result.stellarContractId).toBeNull()
  })

  it('returns defaults when analytics record does not exist', async () => {
    const workerData = { id: 'worker-1', isVerified: true, stellarContractId: 'contract-123' }

    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(workerData)
    vi.mocked(db.workerAnalytics.findUnique).mockResolvedValueOnce(null)

    const result = await getWorkerReputation('worker-1')

    expect(result.avgRating).toBe(0)
    expect(result.reviewCount).toBe(0)
  })

  it('calls both worker and analytics queries in parallel', async () => {
    const workerData = { id: 'worker-1', isVerified: true, stellarContractId: 'contract-123' }

    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(workerData)
    vi.mocked(db.workerAnalytics.findUnique).mockResolvedValueOnce(null)

    await getWorkerReputation('worker-1')

    expect(vi.mocked(db.worker.findUnique)).toHaveBeenCalled()
    expect(vi.mocked(db.workerAnalytics.findUnique)).toHaveBeenCalled()
  })

  it('handles verified and unverified workers', async () => {
    const verifiedWorker = { id: 'worker-1', isVerified: true, stellarContractId: 'contract-123' }
    const unverifiedWorker = { id: 'worker-2', isVerified: false, stellarContractId: null }

    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(verifiedWorker)
    vi.mocked(db.workerAnalytics.findUnique).mockResolvedValueOnce({ avgRating: 90, reviewCount: 50 })

    const result1 = await getWorkerReputation('worker-1')
    expect(result1.isVerified).toBe(true)

    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(unverifiedWorker)
    vi.mocked(db.workerAnalytics.findUnique).mockResolvedValueOnce(null)

    const result2 = await getWorkerReputation('worker-2')
    expect(result2.isVerified).toBe(false)
  })
})
