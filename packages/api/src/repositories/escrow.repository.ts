import type { AuditLog, EscrowDispute, EscrowRecord, Prisma } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '@/db.js'

// ── Transaction client ────────────────────────────────────────────────────────

/**
 * A Prisma transaction client. Write methods accept this optionally so callers
 * can compose multiple repository writes into a single atomic transaction.
 */
export type TxClient = Prisma.TransactionClient

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IEscrowRepository extends IRepository<EscrowRecord, Prisma.EscrowRecordCreateInput, Prisma.EscrowRecordUpdateInput> {
  createEscrow(data: Prisma.EscrowRecordUncheckedCreateInput, tx?: TxClient): Promise<EscrowRecord>
  findEscrow(id: string, tx?: TxClient): Promise<EscrowRecord | null>
  findEscrowWithDisputes(id: string, tx?: TxClient): Promise<(EscrowRecord & { disputes: EscrowDispute[] }) | null>
  updateEscrow(id: string, data: Prisma.EscrowRecordUpdateInput, tx?: TxClient): Promise<EscrowRecord>
  listEscrows(where: Prisma.EscrowRecordWhereInput, opts: { skip: number; take: number }, tx?: TxClient): Promise<{ data: EscrowRecord[]; total: number }>

  createDispute(data: Prisma.EscrowDisputeUncheckedCreateInput, tx?: TxClient): Promise<EscrowDispute>
  createDisputeAndMarkEscrow(escrowId: string, data: Prisma.EscrowDisputeUncheckedCreateInput, tx?: TxClient): Promise<EscrowDispute>
  findDispute(id: string, tx?: TxClient): Promise<(EscrowDispute & { escrow: EscrowRecord }) | null>
  updateDisputeAndEscrow(
    disputeId: string,
    disputeData: Prisma.EscrowDisputeUpdateInput,
    escrowId: string,
    escrowData: Prisma.EscrowRecordUpdateInput,
    tx?: TxClient,
  ): Promise<EscrowDispute>
  updateDispute(id: string, data: Prisma.EscrowDisputeUpdateInput, tx?: TxClient): Promise<EscrowDispute>

  createAuditLog(data: Prisma.AuditLogUncheckedCreateInput, tx?: TxClient): Promise<AuditLog>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class EscrowRepository implements IEscrowRepository {
  async findById(id: string): Promise<EscrowRecord | null> {
    return db.escrowRecord.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<EscrowRecord[]> {
    return db.escrowRecord.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.EscrowRecordCreateInput): Promise<EscrowRecord> {
    return db.escrowRecord.create({ data })
  }

  async update(id: string, data: Prisma.EscrowRecordUpdateInput): Promise<EscrowRecord> {
    return db.escrowRecord.update({ where: { id }, data })
  }

  async delete(id: string): Promise<EscrowRecord> {
    return db.escrowRecord.delete({ where: { id } })
  }

  async count(where?: Prisma.EscrowRecordWhereInput): Promise<number> {
    return db.escrowRecord.count({ where })
  }

  async createEscrow(data: Prisma.EscrowRecordUncheckedCreateInput, tx?: TxClient): Promise<EscrowRecord> {
    return (tx ?? db).escrowRecord.create({ data })
  }

  async findEscrow(id: string, tx?: TxClient): Promise<EscrowRecord | null> {
    return (tx ?? db).escrowRecord.findUnique({ where: { id } })
  }

  async findEscrowWithDisputes(id: string, tx?: TxClient): Promise<(EscrowRecord & { disputes: EscrowDispute[] }) | null> {
    return (tx ?? db).escrowRecord.findUnique({ where: { id }, include: { disputes: true } })
  }

  async updateEscrow(id: string, data: Prisma.EscrowRecordUpdateInput, tx?: TxClient): Promise<EscrowRecord> {
    return (tx ?? db).escrowRecord.update({ where: { id }, data })
  }

  async listEscrows(
    where: Prisma.EscrowRecordWhereInput,
    opts: { skip: number; take: number },
    tx?: TxClient,
  ): Promise<{ data: EscrowRecord[]; total: number }> {
    const client = tx ?? db
    const [data, total] = await Promise.all([
      client.escrowRecord.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { disputes: true } } },
      }),
      client.escrowRecord.count({ where }),
    ])
    return { data, total }
  }

  async createDispute(data: Prisma.EscrowDisputeUncheckedCreateInput, tx?: TxClient): Promise<EscrowDispute> {
    return (tx ?? db).escrowDispute.create({ data })
  }

  async createDisputeAndMarkEscrow(
    escrowId: string,
    data: Prisma.EscrowDisputeUncheckedCreateInput,
    tx?: TxClient,
  ): Promise<EscrowDispute> {
    // When a transaction client is supplied, run both writes inside it so the
    // caller controls the transaction boundary. Otherwise open our own.
    if (tx) {
      const dispute = await tx.escrowDispute.create({ data })
      await tx.escrowRecord.update({ where: { id: escrowId }, data: { status: 'disputed' } })
      return dispute
    }
    return db.$transaction(async (inner) => {
      const dispute = await inner.escrowDispute.create({ data })
      await inner.escrowRecord.update({ where: { id: escrowId }, data: { status: 'disputed' } })
      return dispute
    })
  }

  async findDispute(id: string, tx?: TxClient): Promise<(EscrowDispute & { escrow: EscrowRecord }) | null> {
    return (tx ?? db).escrowDispute.findUnique({ where: { id }, include: { escrow: true } })
  }

  async updateDisputeAndEscrow(
    disputeId: string,
    disputeData: Prisma.EscrowDisputeUpdateInput,
    escrowId: string,
    escrowData: Prisma.EscrowRecordUpdateInput,
    tx?: TxClient,
  ): Promise<EscrowDispute> {
    if (tx) {
      const dispute = await tx.escrowDispute.update({ where: { id: disputeId }, data: disputeData })
      await tx.escrowRecord.update({ where: { id: escrowId }, data: escrowData })
      return dispute
    }
    return db.$transaction(async (inner) => {
      const dispute = await inner.escrowDispute.update({ where: { id: disputeId }, data: disputeData })
      await inner.escrowRecord.update({ where: { id: escrowId }, data: escrowData })
      return dispute
    })
  }

  async updateDispute(id: string, data: Prisma.EscrowDisputeUpdateInput, tx?: TxClient): Promise<EscrowDispute> {
    return (tx ?? db).escrowDispute.update({ where: { id }, data })
  }

  async createAuditLog(data: Prisma.AuditLogUncheckedCreateInput, tx?: TxClient): Promise<AuditLog> {
    return (tx ?? db).auditLog.create({ data })
  }
}

export const escrowRepository = new EscrowRepository()
