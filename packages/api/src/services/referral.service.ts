import crypto from 'node:crypto'
import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'

function generateCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

/** Get or create a referral code for a user */
export async function getOrCreateReferralCode(userId: string) {
  let user = await db.user.findUnique({ where: { id: userId }, select: { id: true, referralCode: true } })
  if (!user) throw new AppError('User not found', 404)

  if (!user.referralCode) {
    let code: string
    do { code = generateCode() } while (await db.user.findUnique({ where: { referralCode: code } }))
    user = await db.user.update({ where: { id: userId }, data: { referralCode: code }, select: { id: true, referralCode: true } })
  }

  return { referralCode: user.referralCode }
}

/** Apply a referral code during registration — call after user is created */
export async function applyReferralCode(refereeId: string, code: string) {
  const referrer = await db.user.findUnique({ where: { referralCode: code } })
  if (!referrer) throw new AppError('Invalid referral code', 400)
  if (referrer.id === refereeId) throw new AppError('Cannot refer yourself', 400)

  // Check not already referred
  const existing = await db.referral.findUnique({ where: { refereeId } })
  if (existing) throw new AppError('User already used a referral code', 400)

  return db.referral.create({
    data: { referrerId: referrer.id, refereeId, code, status: 'converted', convertedAt: new Date() },
  })
}

/** Mark a referral as rewarded */
export async function rewardReferral(referralId: string) {
  const referral = await db.referral.findUnique({ where: { id: referralId } })
  if (!referral) throw new AppError('Referral not found', 404)
  if (referral.rewardGiven) throw new AppError('Reward already given', 400)
  return db.referral.update({ where: { id: referralId }, data: { status: 'rewarded', rewardGiven: true } })
}

/** Analytics: referral stats for a user */
export async function getReferralStats(userId: string) {
  const [total, converted, rewarded] = await Promise.all([
    db.referral.count({ where: { referrerId: userId } }),
    db.referral.count({ where: { referrerId: userId, status: { in: ['converted', 'rewarded'] } } }),
    db.referral.count({ where: { referrerId: userId, status: 'rewarded' } }),
  ])
  return { total, converted, rewarded }
}

/** Leaderboard: top referrers */
export async function getReferralLeaderboard(limit = 10) {
  const results = await db.referral.groupBy({
    by: ['referrerId'],
    where: { status: { in: ['converted', 'rewarded'] } },
    _count: { referrerId: true },
    orderBy: { _count: { referrerId: 'desc' } },
    take: limit,
  })

  const userIds = results.map((r) => r.referrerId)
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true },
  })
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]))

  return results.map((r, i) => ({
    rank: i + 1,
    userId: r.referrerId,
    name: `${userMap[r.referrerId]?.firstName ?? ''} ${userMap[r.referrerId]?.lastName ?? ''}`.trim(),
    conversions: r._count.referrerId,
  }))
}
