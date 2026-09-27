import type { Prisma, StellarAccount } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IWalletRepository extends IRepository<StellarAccount, Prisma.StellarAccountCreateInput, Prisma.StellarAccountUpdateInput> {
  upsertAccount(publicKey: string, userId: string, balance: number, sequences: bigint): Promise<StellarAccount>
  findByPublicKey(publicKey: string): Promise<StellarAccount | null>
  findByUserId(userId: string): Promise<StellarAccount | null>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class WalletRepository implements IWalletRepository {
  async findById(id: string): Promise<StellarAccount | null> {
    return db.stellarAccount.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<StellarAccount[]> {
    return db.stellarAccount.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.StellarAccountCreateInput): Promise<StellarAccount> {
    return db.stellarAccount.create({ data })
  }

  async update(id: string, data: Prisma.StellarAccountUpdateInput): Promise<StellarAccount> {
    return db.stellarAccount.update({ where: { id }, data })
  }

  async delete(id: string): Promise<StellarAccount> {
    return db.stellarAccount.delete({ where: { id } })
  }

  async count(where?: Prisma.StellarAccountWhereInput): Promise<number> {
    return db.stellarAccount.count({ where })
  }

  async upsertAccount(publicKey: string, userId: string, balance: number, sequences: bigint): Promise<StellarAccount> {
    return db.stellarAccount.upsert({
      where: { publicKey },
      update: { balance, sequences, lastSyncedAt: new Date() },
      create: { publicKey, userId, balance, sequences, lastSyncedAt: new Date() },
    })
  }

  async findByPublicKey(publicKey: string): Promise<StellarAccount | null> {
    return db.stellarAccount.findUnique({ where: { publicKey } })
  }

  async findByUserId(userId: string): Promise<StellarAccount | null> {
    return db.stellarAccount.findFirst({ where: { userId } })
  }
}

export const walletRepository = new WalletRepository()
