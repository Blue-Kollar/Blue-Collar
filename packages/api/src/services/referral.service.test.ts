/**
 * Unit tests for src/services/referral.service.ts
 *
 * Uses the DI pattern — injects a mock repository directly.
 * No vi.mock() required.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createReferralService } from './referral.service.js'

// ── Mock repo factory ─────────────────────────────────────────────────────────

const makeMockRepo = () => ({
  // IRepository base
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn(),
  // IReferralRepository extras
  findUserById: vi.fn(),
  updateUserReferralCode: vi.fn(),
  findUserByReferralCode: vi.fn(),
  findUniqueReferralCode: vi.fn(),
  findReferralByRefereeId: vi.fn(),
  createReferral: vi.fn(),
  findReferralById: vi.fn(),
  updateReferral: vi.fn(),
  countReferrals: vi.fn(),
  groupReferralsByReferrer: vi.fn(),
  findUsersByIds: vi.fn(),
})

// ── applyReferralCode ─────────────────────────────────────────────────────────

describe('applyReferralCode', () => {
  let repo: ReturnType<typeof makeMockRepo>

  beforeEach(() => {
    repo = makeMockRepo()
  })

  it('creates a referral when the code is valid and not self-referral', async () => {
    repo.findUserByReferralCode.mockResolvedValue({ id: 'referrer-1' })
    repo.findReferralByRefereeId.mockResolvedValue(null)
    repo.createReferral.mockResolvedValue({
      id: 'ref-1',
      referrerId: 'referrer-1',
      refereeId: 'referee-1',
      code: 'ABCD1234',
      status: 'converted',
      rewardGiven: false,
    })

    const svc = createReferralService({ referralRepository: repo })
    const result = await svc.applyReferralCode('referee-1', 'ABCD1234')

    expect(result).toMatchObject({ referrerId: 'referrer-1', refereeId: 'referee-1' })
    expect(repo.createReferral).toHaveBeenCalledWith(
      expect.objectContaining({
        referrerId: 'referrer-1',
        refereeId: 'referee-1',
        code: 'ABCD1234',
        status: 'converted',
      }),
    )
  })

  it('throws 400 for an invalid (non-existent) referral code', async () => {
    repo.findUserByReferralCode.mockResolvedValue(null)

    const svc = createReferralService({ referralRepository: repo })

    await expect(svc.applyReferralCode('referee-1', 'BADCODE')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Invalid referral code',
    })
    expect(repo.createReferral).not.toHaveBeenCalled()
  })

  it('throws 400 when the referee tries to use their own referral code', async () => {
    repo.findUserByReferralCode.mockResolvedValue({ id: 'user-1' })

    const svc = createReferralService({ referralRepository: repo })

    await expect(svc.applyReferralCode('user-1', 'SELFCODE')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Cannot refer yourself',
    })
    expect(repo.createReferral).not.toHaveBeenCalled()
  })

  it('throws 400 when the user has already used a referral code', async () => {
    repo.findUserByReferralCode.mockResolvedValue({ id: 'referrer-1' })
    repo.findReferralByRefereeId.mockResolvedValue({ id: 'existing-ref' })

    const svc = createReferralService({ referralRepository: repo })

    await expect(svc.applyReferralCode('referee-1', 'ABCD1234')).rejects.toMatchObject({
      statusCode: 400,
      message: 'User already used a referral code',
    })
    expect(repo.createReferral).not.toHaveBeenCalled()
  })
})

// ── rewardReferral ────────────────────────────────────────────────────────────

describe('rewardReferral', () => {
  let repo: ReturnType<typeof makeMockRepo>

  beforeEach(() => {
    repo = makeMockRepo()
  })

  it('marks the referral as rewarded on first call', async () => {
    repo.findReferralById.mockResolvedValue({ id: 'ref-1', rewardGiven: false })
    repo.updateReferral.mockResolvedValue({ id: 'ref-1', status: 'rewarded', rewardGiven: true })

    const svc = createReferralService({ referralRepository: repo })
    const result = await svc.rewardReferral('ref-1')

    expect(result).toMatchObject({ status: 'rewarded', rewardGiven: true })
    expect(repo.updateReferral).toHaveBeenCalledWith('ref-1', { status: 'rewarded', rewardGiven: true })
  })

  it('throws 400 when the reward has already been given', async () => {
    repo.findReferralById.mockResolvedValue({ id: 'ref-1', rewardGiven: true })

    const svc = createReferralService({ referralRepository: repo })

    await expect(svc.rewardReferral('ref-1')).rejects.toMatchObject({
      statusCode: 400,
      message: 'Reward already given',
    })
    expect(repo.updateReferral).not.toHaveBeenCalled()
  })

  it('throws 404 when the referral does not exist', async () => {
    repo.findReferralById.mockResolvedValue(null)

    const svc = createReferralService({ referralRepository: repo })

    await expect(svc.rewardReferral('missing-id')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Referral not found',
    })
    expect(repo.updateReferral).not.toHaveBeenCalled()
  })
})

// ── getOrCreateReferralCode ───────────────────────────────────────────────────

describe('getOrCreateReferralCode', () => {
  let repo: ReturnType<typeof makeMockRepo>

  beforeEach(() => {
    repo = makeMockRepo()
  })

  it('returns the existing code when the user already has one', async () => {
    repo.findUserById.mockResolvedValue({ id: 'user-1', referralCode: 'EXIST123' })

    const svc = createReferralService({ referralRepository: repo })
    const result = await svc.getOrCreateReferralCode('user-1')

    expect(result).toEqual({ referralCode: 'EXIST123' })
    expect(repo.updateUserReferralCode).not.toHaveBeenCalled()
  })

  it('generates and persists a new code when the user has none', async () => {
    repo.findUserById.mockResolvedValue({ id: 'user-1', referralCode: null })
    repo.findUniqueReferralCode.mockResolvedValue(null) // no collision
    repo.updateUserReferralCode.mockResolvedValue({ id: 'user-1', referralCode: 'NEWC0DE1' })

    const svc = createReferralService({ referralRepository: repo })
    const result = await svc.getOrCreateReferralCode('user-1')

    expect(result).toEqual({ referralCode: 'NEWC0DE1' })
    expect(repo.updateUserReferralCode).toHaveBeenCalledWith('user-1', expect.any(String))
  })

  it('retries code generation on collision', async () => {
    repo.findUserById.mockResolvedValue({ id: 'user-1', referralCode: null })
    // First generated code collides, second is free
    repo.findUniqueReferralCode
      .mockResolvedValueOnce({ referralCode: 'TAKEN000' })
      .mockResolvedValueOnce(null)
    repo.updateUserReferralCode.mockResolvedValue({ id: 'user-1', referralCode: 'NEWCODE2' })

    const svc = createReferralService({ referralRepository: repo })
    await svc.getOrCreateReferralCode('user-1')

    expect(repo.findUniqueReferralCode).toHaveBeenCalledTimes(2)
    expect(repo.updateUserReferralCode).toHaveBeenCalledTimes(1)
  })

  it('throws 404 when the user does not exist', async () => {
    repo.findUserById.mockResolvedValue(null)

    const svc = createReferralService({ referralRepository: repo })

    await expect(svc.getOrCreateReferralCode('missing')).rejects.toMatchObject({
      statusCode: 404,
      message: 'User not found',
    })
  })
})

// ── getReferralStats ──────────────────────────────────────────────────────────

describe('getReferralStats', () => {
  it('returns total, converted, and rewarded counts', async () => {
    const repo = makeMockRepo()
    repo.countReferrals
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(7)  // converted
      .mockResolvedValueOnce(3)  // rewarded

    const svc = createReferralService({ referralRepository: repo })
    const result = await svc.getReferralStats('user-1')

    expect(result).toEqual({ total: 10, converted: 7, rewarded: 3 })
    expect(repo.countReferrals).toHaveBeenCalledTimes(3)
  })
})

// ── getReferralLeaderboard ────────────────────────────────────────────────────

describe('getReferralLeaderboard', () => {
  it('returns ranked entries with display names', async () => {
    const repo = makeMockRepo()
    repo.groupReferralsByReferrer.mockResolvedValue([
      { referrerId: 'user-1', _count: { referrerId: 5 } },
      { referrerId: 'user-2', _count: { referrerId: 3 } },
    ])
    repo.findUsersByIds.mockResolvedValue([
      { id: 'user-1', firstName: 'Alice', lastName: 'Smith' },
      { id: 'user-2', firstName: 'Bob', lastName: 'Jones' },
    ])

    const svc = createReferralService({ referralRepository: repo })
    const result = await svc.getReferralLeaderboard(10)

    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ rank: 1, userId: 'user-1', name: 'Alice Smith', conversions: 5 })
    expect(result[1]).toEqual({ rank: 2, userId: 'user-2', name: 'Bob Jones', conversions: 3 })
    expect(repo.groupReferralsByReferrer).toHaveBeenCalledWith(10)
  })

  it('uses default limit of 10', async () => {
    const repo = makeMockRepo()
    repo.groupReferralsByReferrer.mockResolvedValue([])
    repo.findUsersByIds.mockResolvedValue([])

    const svc = createReferralService({ referralRepository: repo })
    await svc.getReferralLeaderboard()

    expect(repo.groupReferralsByReferrer).toHaveBeenCalledWith(10)
  })
})
