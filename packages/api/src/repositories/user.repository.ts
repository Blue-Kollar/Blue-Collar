import type { User, Prisma } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { BaseRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IUserRepository extends IRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput> {
  findByEmail(email: string): Promise<User | null>
  findByGoogleId(googleId: string): Promise<User | null>
  findByResetToken(token: string): Promise<User | null>
  findByVerificationToken(token: string): Promise<User | null>
  findByReferralCode(code: string): Promise<User | null>
}

// ── Prisma implementation ─────────────────────────────────────────────────────
//
// CRUD (find/create/update/delete/count) is inherited from BaseRepository,
// which also fixes a prior inconsistency here: findById used to skip the
// deletedAt filter that findAll applied, so a soft-deleted user could still
// be looked up by id. BaseRepository applies the filter uniformly.

export class UserRepository extends BaseRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput, Prisma.UserWhereInput> implements IUserRepository {
  constructor() {
    super(db.user, { softDelete: true })
  }

  async findByEmail(email: string): Promise<User | null> {
    return db.user.findUnique({ where: { email } })
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return db.user.findUnique({ where: { googleId } })
  }

  async findByResetToken(token: string): Promise<User | null> {
    return db.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    })
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return db.user.findFirst({
      where: { verificationToken: token, verificationTokenExpiry: { gt: new Date() } },
    })
  }

  async findByReferralCode(code: string): Promise<User | null> {
    return db.user.findUnique({ where: { referralCode: code } })
  }
}

export const userRepository = new UserRepository()
