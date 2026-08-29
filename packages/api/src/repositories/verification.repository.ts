import type { Prisma, VerificationRequest, Worker } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IVerificationRepository extends IRepository<VerificationRequest, Prisma.VerificationRequestCreateInput, Prisma.VerificationRequestUpdateInput> {
  findWorkerById(id: string): Promise<Worker | null>
  findPendingByWorker(workerId: string): Promise<VerificationRequest | null>
  createRequest(data: Prisma.VerificationRequestUncheckedCreateInput): Promise<VerificationRequest & { worker: Worker }>
  findManyRequests(where: Prisma.VerificationRequestWhereInput, opts: { skip: number; take: number }): Promise<{ data: VerificationRequest[]; total: number }>
  findRequestById(id: string): Promise<(VerificationRequest & { worker: Worker; requestedBy: { id: string; firstName: string; lastName: string; email: string } }) | null>
  updateRequest(id: string, data: Prisma.VerificationRequestUpdateInput): Promise<VerificationRequest & { worker: Worker; requestedBy: { id: string; firstName: string; lastName: string; email: string } }>
  updateWorkerVerified(id: string, isVerified: boolean): Promise<Worker>
  findRequestsByWorker(workerId: string): Promise<VerificationRequest[]>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class VerificationRepository implements IVerificationRepository {
  async findById(id: string): Promise<VerificationRequest | null> {
    return db.verificationRequest.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<VerificationRequest[]> {
    return db.verificationRequest.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.VerificationRequestCreateInput): Promise<VerificationRequest> {
    return db.verificationRequest.create({ data })
  }

  async update(id: string, data: Prisma.VerificationRequestUpdateInput): Promise<VerificationRequest> {
    return db.verificationRequest.update({ where: { id }, data })
  }

  async delete(id: string): Promise<VerificationRequest> {
    return db.verificationRequest.delete({ where: { id } })
  }

  async count(where?: Prisma.VerificationRequestWhereInput): Promise<number> {
    return db.verificationRequest.count({ where })
  }

  async findWorkerById(id: string): Promise<Worker | null> {
    return db.worker.findUnique({ where: { id } })
  }

  async findPendingByWorker(workerId: string): Promise<VerificationRequest | null> {
    return db.verificationRequest.findFirst({ where: { workerId, status: 'pending' } })
  }

  async createRequest(data: Prisma.VerificationRequestUncheckedCreateInput) {
    return db.verificationRequest.create({ data, include: { worker: true } })
  }

  async findManyRequests(
    where: Prisma.VerificationRequestWhereInput,
    opts: { skip: number; take: number },
  ): Promise<{ data: VerificationRequest[]; total: number }> {
    const [data, total] = await Promise.all([
      db.verificationRequest.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy: { createdAt: 'desc' },
        include: {
          worker: true,
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      db.verificationRequest.count({ where }),
    ])
    return { data, total }
  }

  async findRequestById(id: string) {
    return db.verificationRequest.findUnique({
      where: { id },
      include: {
        worker: true,
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    })
  }

  async updateRequest(id: string, data: Prisma.VerificationRequestUpdateInput) {
    return db.verificationRequest.update({
      where: { id },
      data,
      include: {
        worker: true,
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    })
  }

  async updateWorkerVerified(id: string, isVerified: boolean): Promise<Worker> {
    return db.worker.update({ where: { id }, data: { isVerified } })
  }

  async findRequestsByWorker(workerId: string): Promise<VerificationRequest[]> {
    return db.verificationRequest.findMany({
      where: { workerId },
      orderBy: { createdAt: 'desc' },
      include: { reviewedBy: { select: { id: true, firstName: true, lastName: true } } },
    })
  }
}

export const verificationRepository = new VerificationRepository()
