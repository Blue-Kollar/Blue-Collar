import type { InsuranceDocument, Prisma, Worker } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IInsuranceRepository extends IRepository<InsuranceDocument, Prisma.InsuranceDocumentCreateInput, Prisma.InsuranceDocumentUpdateInput> {
  findWorkerById(id: string): Promise<Worker | null>
  createDocument(data: Prisma.InsuranceDocumentUncheckedCreateInput): Promise<InsuranceDocument>
  findByWorker(workerId: string): Promise<InsuranceDocument[]>
  findDocumentById(id: string): Promise<InsuranceDocument | null>
  updateStatus(id: string, status: string): Promise<InsuranceDocument>
  findExpiring(threshold: Date): Promise<(InsuranceDocument & { worker: Worker & { curator: { email: string } } })[]>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class InsuranceRepository implements IInsuranceRepository {
  async findById(id: string): Promise<InsuranceDocument | null> {
    return db.insuranceDocument.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<InsuranceDocument[]> {
    return db.insuranceDocument.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.InsuranceDocumentCreateInput): Promise<InsuranceDocument> {
    return db.insuranceDocument.create({ data })
  }

  async update(id: string, data: Prisma.InsuranceDocumentUpdateInput): Promise<InsuranceDocument> {
    return db.insuranceDocument.update({ where: { id }, data })
  }

  async delete(id: string): Promise<InsuranceDocument> {
    return db.insuranceDocument.delete({ where: { id } })
  }

  async count(where?: Prisma.InsuranceDocumentWhereInput): Promise<number> {
    return db.insuranceDocument.count({ where })
  }

  async findWorkerById(id: string): Promise<Worker | null> {
    return db.worker.findUnique({ where: { id } })
  }

  async createDocument(data: Prisma.InsuranceDocumentUncheckedCreateInput): Promise<InsuranceDocument> {
    return db.insuranceDocument.create({ data })
  }

  async findByWorker(workerId: string): Promise<InsuranceDocument[]> {
    return db.insuranceDocument.findMany({ where: { workerId }, orderBy: { createdAt: 'desc' } })
  }

  async findDocumentById(id: string): Promise<InsuranceDocument | null> {
    return db.insuranceDocument.findUnique({ where: { id } })
  }

  async updateStatus(id: string, status: string): Promise<InsuranceDocument> {
    return db.insuranceDocument.update({ where: { id }, data: { status: status as any } })
  }

  async findExpiring(threshold: Date) {
    return db.insuranceDocument.findMany({
      where: { expiresAt: { lte: threshold }, status: 'verified' },
      include: { worker: { include: { curator: true } } },
    })
  }
}

export const insuranceRepository = new InsuranceRepository()
