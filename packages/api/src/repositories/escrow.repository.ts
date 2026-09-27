import type { AuditLog, EscrowDispute, EscrowRecord, Prisma } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IEscrowRepository extends IRepository<EscrowRecord, Prisma.EscrowRecordCreateInput, Prisma.EscrowRecordUpdateInput> {
  createEscrow(data: Prisma.EscrowRecordUncheckedCreateInput): Promise<EscrowRecord>
  findEscrow(id: string): Promise<EscrowRecord | null>
  findEscrowWithDisputes(id: string): Promise<(EscrowRecord & { disputes: EscrowDispute[] }) | null>
  updateEscrow(id: string, data: Prisma.EscrowRecordUpdateInput): Promise<EscrowRecord>
  listEscrows(where: Prisma.EscrowRecordWhereInput, opts: { skip: number; take: number }): Promise<{ data: EscrowRecord[]; total: number }>

  createDispute(data: Prisma.EscrowDisputeUncheckedCreateInput): Promise<EscrowDispute>
  createDisputeAndMarkEscrow(escrowId: string, data: Prisma.EscrowDisputeUncheckedCreateInput): Promise<EscrowDispute>
  findDispute(id: string): Promise<(EscrowDispute & { escrow: EscrowRecord }) | null>
  updateDisputeAndEscrow(
    disputeId: string,
    disputeData: Prisma.EscrowDisputeUpdateInput,
    escrowId: string,
    escrowData: Prisma.EscrowRecordUpdateInput,
  ): Promise<EscrowDispute>
  updateDispute(id: string, data: Prisma.EscrowDisputeUpdateInput): Promise<EscrowDispute>

  createAuditLog(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog>
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

  async createEscrow(data: Prisma.EscrowRecordUncheckedCreateInput): Promise<EscrowRecord> {
    return db.escrowRecord.create({ data })
  }

  async findEscrow(id: string): Promise<EscrowRecord | null> {
    return db.escrowRecord.findUnique({ where: { id } })
  }

  async findEscrowWithDisputes(id: string): Promise<(EscrowRecord & { disputes: EscrowDispute[] }) | null> {
    return db.escrowRecord.findUnique({ where: { id }, include: { disputes: true } })
  }

  async updateEscrow(id: string, data: Prisma.EscrowRecordUpdateInput): Promise<EscrowRecord> {
    return db.escrowRecord.update({ where: { id }, data })
  }

  async listEscrows(
    where: Prisma.EscrowRecordWhereInput,
    opts: { skip: number; take: number },
  ): Promise<{ data: EscrowRecord[]; total: number }> {
    const [data, total] = await Promise.all([
      db.escrowRecord.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { disputes: true } } },
      }),
      db.escrowRecord.count({ where }),
    ])
    return { data, total }
  }

  async createDispute(data: Prisma.EscrowDisputeUncheckedCreateInput): Promise<EscrowDispute> {
    return db.escrowDispute.create({ data })
  }

  async createDisputeAndMarkEscrow(escrowId: string, data: Prisma.EscrowDisputeUncheckedCreateInput): Promise<EscrowDispute> {
    const [dispute] = await db.$transaction([
      db.escrowDispute.create({ data }),
      db.escrowRecord.update({ where: { id: escrowId }, data: { status: 'disputed' } }),
    ])
    return dispute
  }

  async findDispute(id: string): Promise<(EscrowDispute & { escrow: EscrowRecord }) | null> {
    return db.escrowDispute.findUnique({ where: { id }, include: { escrow: true } })
  }

  async updateDisputeAndEscrow(
    disputeId: string,
    disputeData: Prisma.EscrowDisputeUpdateInput,
    escrowId: string,
    escrowData: Prisma.EscrowRecordUpdateInput,
  ): Promise<EscrowDispute> {
    const [dispute] = await db.$transaction([
      db.escrowDispute.update({ where: { id: disputeId }, data: disputeData }),
      db.escrowRecord.update({ where: { id: escrowId }, data: escrowData }),
    ])
    return dispute
  }

  async updateDispute(id: string, data: Prisma.EscrowDisputeUpdateInput): Promise<EscrowDispute> {
    return db.escrowDispute.update({ where: { id }, data })
  }

  async createAuditLog(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog> {
    return db.auditLog.create({ data })
  }
}

export const escrowRepository = new EscrowRepository()
