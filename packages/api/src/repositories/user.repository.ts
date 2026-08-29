import type { User, Prisma } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'
import { QueryBuilder } from './queryBuilder.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IUserRepository extends IRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput> {
  findByEmail(email: string): Promise<User | null>
  findByGoogleId(googleId: string): Promise<User | null>
  findByResetToken(token: string): Promise<User | null>
  findByVerificationToken(token: string): Promise<User | null>
  findByReferralCode(code: string): Promise<User | null>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class UserRepository implements IUserRepository {
  async findById(id: string): Promise<User | null> {
    return db.user.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<User[]> {
    const query = QueryBuilder.pagination(opts)
    return db.user.findMany({ ...query, where: { deletedAt: null }, orderBy: QueryBuilder.defaultSort() })
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return db.user.create({ data })
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return db.user.update({ where: { id }, data })
  }

  /** Soft-delete: sets deletedAt to now() instead of issuing a hard DELETE. */
  async delete(id: string): Promise<User> {
    return db.user.update({ where: { id }, data: { deletedAt: new Date() } })
  }

  async count(where?: Prisma.UserWhereInput): Promise<number> {
    return db.user.count({ where })
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
