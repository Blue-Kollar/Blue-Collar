import crypto from 'node:crypto'
import { referralRepository as defaultReferralRepository } from '../repositories/referral.repository.js'
import { AppError } from '../utils/AppError.js'
import type { ReferralServiceDeps } from '../container/types.js'

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

// ── Factory ───────────────────────────────────────────────────────────────────

export function createReferralService(deps: ReferralServiceDeps) {
  const { referralRepository: repo } = deps

  return {
    /** Get or create a referral code for a user */
    async getOrCreateReferralCode(userId: string) {
      let user = await repo.findUserById(userId)
      if (!user) throw new AppError('User not found', 404)

      if (!user.referralCode) {
        let code: string
        do {
          code = generateCode()
        } while (await repo.findUniqueReferralCode(code))
        user = await repo.updateUserReferralCode(userId, code)
      }

      return { referralCode: user.referralCode }
    },

    /** Apply a referral code during registration — call after user is created */
    async applyReferralCode(refereeId: string, code: string) {
      const referrer = await repo.findUserByReferralCode(code)
      if (!referrer) throw new AppError('Invalid referral code', 400)
      if (referrer.id === refereeId) throw new AppError('Cannot refer yourself', 400)

      const existing = await repo.findReferralByRefereeId(refereeId)
      if (existing) throw new AppError('User already used a referral code', 400)

      return repo.createReferral({
        referrerId: referrer.id,
        refereeId,
        code,
        status: 'converted',
        convertedAt: new Date(),
      } as any)
    },

    /** Mark a referral as rewarded */
    async rewardReferral(referralId: string) {
      const referral = await repo.findReferralById(referralId)
      if (!referral) throw new AppError('Referral not found', 404)
      if ((referral as any).rewardGiven) throw new AppError('Reward already given', 400)
      return repo.updateReferral(referralId, { status: 'rewarded', rewardGiven: true } as any)
    },

    /** Analytics: referral stats for a user */
    async getReferralStats(userId: string) {
      const [total, converted, rewarded] = await Promise.all([
        repo.countReferrals({ referrerId: userId }),
        repo.countReferrals({ referrerId: userId, status: { in: ['converted', 'rewarded'] } }),
        repo.countReferrals({ referrerId: userId, status: 'rewarded' }),
      ])
      return { total, converted, rewarded }
    },

    /** Leaderboard: top referrers */
    async getReferralLeaderboard(limit = 10) {
      const results = await repo.groupReferralsByReferrer(limit)

      const userIds = results.map((r: any) => r.referrerId)
      const users = await repo.findUsersByIds(userIds)
      const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]))

      return results.map((r: any, i: number) => ({
        rank: i + 1,
        userId: r.referrerId,
        name: `${userMap[r.referrerId]?.firstName ?? ''} ${userMap[r.referrerId]?.lastName ?? ''}`.trim(),
        conversions: r._count.referrerId,
      }))
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createReferralService({
  referralRepository: defaultReferralRepository,
})

export async function getOrCreateReferralCode(userId: string) {
  return _defaultService.getOrCreateReferralCode(userId)
}

export async function applyReferralCode(refereeId: string, code: string) {
  return _defaultService.applyReferralCode(refereeId, code)
}

export async function rewardReferral(referralId: string) {
  return _defaultService.rewardReferral(referralId)
}

export async function getReferralStats(userId: string) {
  return _defaultService.getReferralStats(userId)
}

export async function getReferralLeaderboard(limit = 10) {
  return _defaultService.getReferralLeaderboard(limit)
}
