import type { Dispute, Prisma } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Include ───────────────────────────────────────────────────────────────────

const disputeInclude = {
  worker: { select: { id: true, name: true } },
  filedBy: { select: { id: true, firstName: true, lastName: true } },
} as const

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IDisputeRepository extends IRepository<Dispute, Prisma.DisputeCreateInput, Prisma.DisputeUpdateInput> {
  findWorkerById(id: string): Promise<{ id: string } | null>
  findWithRelations(id: string): Promise<Dispute | null>
  findManyWithRelations(where: Prisma.DisputeWhereInput, opts: { skip: number; take: number }): Promise<{ data: Dispute[]; total: number }>
  createDispute(data: Prisma.DisputeCreateInput): Promise<Dispute>
  updateDispute(id: string, data: Prisma.DisputeUpdateInput): Promise<Dispute>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class DisputeRepository implements IDisputeRepository {
  async findById(id: string): Promise<Dispute | null> {
    return db.dispute.findUnique({ where: { id } })
  }

  async findWorkerById(id: string): Promise<{ id: string } | null> {
    return db.worker.findUnique({ where: { id }, select: { id: true } })
  }

  async findWithRelations(id: string): Promise<Dispute | null> {
    return db.dispute.findUnique({ where: { id }, include: disputeInclude })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Dispute[]> {
    return db.dispute.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async findManyWithRelations(
    where: Prisma.DisputeWhereInput,
    opts: { skip: number; take: number },
  ): Promise<{ data: Dispute[]; total: number }> {
    const [data, total] = await Promise.all([
      db.dispute.findMany({ where, skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' }, include: disputeInclude }),
      db.dispute.count({ where }),
    ])
    return { data, total }
  }

  async create(data: Prisma.DisputeCreateInput): Promise<Dispute> {
    return db.dispute.create({ data })
  }

  async createDispute(data: Prisma.DisputeCreateInput): Promise<Dispute> {
    return db.dispute.create({ data, include: disputeInclude })
  }

  async update(id: string, data: Prisma.DisputeUpdateInput): Promise<Dispute> {
    return db.dispute.update({ where: { id }, data })
  }

  async updateDispute(id: string, data: Prisma.DisputeUpdateInput): Promise<Dispute> {
    return db.dispute.update({ where: { id }, data, include: { worker: { select: { id: true, name: true } } } })
  }

  async delete(id: string): Promise<Dispute> {
    return db.dispute.delete({ where: { id } })
  }

  async count(where?: Prisma.DisputeWhereInput): Promise<number> {
    return db.dispute.count({ where })
  }
}

export const disputeRepository = new DisputeRepository()
