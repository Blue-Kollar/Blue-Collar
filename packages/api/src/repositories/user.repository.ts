import type { User, Prisma, PrismaClient } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { BaseRepository } from './base.repository.js'
import { db } from '@/db.js'

// A transaction client exposes the same model delegates as PrismaClient but
// omits lifecycle methods ($connect/$disconnect/$transaction). Write methods
// accept one so callers can compose multiple writes atomically (#1814).
export type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IUserRepository extends IRepository<User, Prisma.UserCreateInput, Prisma.UserUpdateInput> {
  findByEmail(email: string): Promise<User | null>
  findByGoogleId(googleId: string): Promise<User | null>
  findByResetToken(token: string): Promise<User | null>
  findByVerificationToken(token: string): Promise<User | null>
  findByReferralCode(code: string): Promise<User | null>
  create(data: Prisma.UserCreateInput, tx?: TransactionClient): Promise<User>
  update(id: string, data: Prisma.UserUpdateInput, tx?: TransactionClient): Promise<User>
  delete(id: string, tx?: TransactionClient): Promise<User>
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

  // ── Write methods ──────────────────────────────────────────────────────────
  //
  // These override BaseRepository so a caller-supplied transaction client is
  // honoured. When `tx` is omitted they fall back to the shared `db` client,
  // preserving existing single-write behaviour.

  async create(data: Prisma.UserCreateInput, tx?: TransactionClient): Promise<User> {
    return (tx ?? db).user.create({ data })
  }

  async update(id: string, data: Prisma.UserUpdateInput, tx?: TransactionClient): Promise<User> {
    return (tx ?? db).user.update({ where: { id }, data })
  }

  async delete(id: string, tx?: TransactionClient): Promise<User> {
    // Soft delete: stamp deletedAt rather than removing the row.
    return (tx ?? db).user.update({ where: { id }, data: { deletedAt: new Date() } })
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
