import type { Prisma, Referral, User } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IReferralRepository extends IRepository<Referral, Prisma.ReferralCreateInput, Prisma.ReferralUpdateInput> {
  findUserById(id: string): Promise<{ id: string; referralCode: string | null } | null>
  updateUserReferralCode(id: string, code: string): Promise<{ id: string; referralCode: string | null }>
  findUserByReferralCode(code: string): Promise<User | null>
  findUniqueReferralCode(code: string): Promise<{ referralCode: string | null } | null>
  findReferralByRefereeId(refereeId: string): Promise<Referral | null>
  createReferral(data: Prisma.ReferralUncheckedCreateInput): Promise<Referral>
  findReferralById(id: string): Promise<Referral | null>
  updateReferral(id: string, data: Prisma.ReferralUpdateInput): Promise<Referral>
  countReferrals(where: Prisma.ReferralWhereInput): Promise<number>
  groupReferralsByReferrer(take: number): Promise<{ referrerId: string; _count: { referrerId: number } }[]>
  findUsersByIds(ids: string[]): Promise<{ id: string; firstName: string; lastName: string }[]>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class ReferralRepository implements IReferralRepository {
  async findById(id: string): Promise<Referral | null> {
    return db.referral.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Referral[]> {
    return db.referral.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.ReferralCreateInput): Promise<Referral> {
    return db.referral.create({ data })
  }

  async update(id: string, data: Prisma.ReferralUpdateInput): Promise<Referral> {
    return db.referral.update({ where: { id }, data })
  }

  async delete(id: string): Promise<Referral> {
    return db.referral.delete({ where: { id } })
  }

  async count(where?: Prisma.ReferralWhereInput): Promise<number> {
    return db.referral.count({ where })
  }

  async findUserById(id: string): Promise<{ id: string; referralCode: string | null } | null> {
    return db.user.findUnique({ where: { id }, select: { id: true, referralCode: true } })
  }

  async updateUserReferralCode(id: string, code: string): Promise<{ id: string; referralCode: string | null }> {
    return db.user.update({ where: { id }, data: { referralCode: code }, select: { id: true, referralCode: true } })
  }

  async findUserByReferralCode(code: string): Promise<User | null> {
    return db.user.findUnique({ where: { referralCode: code } })
  }

  async findUniqueReferralCode(code: string): Promise<{ referralCode: string | null } | null> {
    return db.user.findUnique({ where: { referralCode: code }, select: { referralCode: true } })
  }

  async findReferralByRefereeId(refereeId: string): Promise<Referral | null> {
    return db.referral.findUnique({ where: { refereeId } })
  }

  async createReferral(data: Prisma.ReferralUncheckedCreateInput): Promise<Referral> {
    return db.referral.create({ data })
  }

  async findReferralById(id: string): Promise<Referral | null> {
    return db.referral.findUnique({ where: { id } })
  }

  async updateReferral(id: string, data: Prisma.ReferralUpdateInput): Promise<Referral> {
    return db.referral.update({ where: { id }, data })
  }

  async countReferrals(where: Prisma.ReferralWhereInput): Promise<number> {
    return db.referral.count({ where })
  }

  async groupReferralsByReferrer(take: number): Promise<{ referrerId: string; _count: { referrerId: number } }[]> {
    return db.referral.groupBy({
      by: ['referrerId'],
      where: { status: { in: ['converted', 'rewarded'] } },
      _count: { referrerId: true },
      orderBy: { _count: { referrerId: 'desc' } },
      take,
    })
  }

  async findUsersByIds(ids: string[]): Promise<{ id: string; firstName: string; lastName: string }[]> {
    return db.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, firstName: true, lastName: true },
    })
  }
}

export const referralRepository = new ReferralRepository()
