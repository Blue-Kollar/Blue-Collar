import type { ContactRequest, Prisma, Worker } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IContactRequestRepository extends IRepository<ContactRequest, Prisma.ContactRequestCreateInput, Prisma.ContactRequestUpdateInput> {
  findWorkerWithCurator(id: string): Promise<(Worker & { curator: { email: string; name?: string } }) | null>
  createContactRequest(data: Prisma.ContactRequestUncheckedCreateInput): Promise<ContactRequest & { fromUser: { firstName: string }; worker: Worker }>
  findContactRequests(workerId: string): Promise<ContactRequest[]>
  findContactRequestById(id: string): Promise<ContactRequest | null>
  updateContactRequestStatus(id: string, status: string): Promise<ContactRequest & { fromUser: { firstName: string }; worker: Worker }>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class ContactRequestRepository implements IContactRequestRepository {
  async findById(id: string): Promise<ContactRequest | null> {
    return db.contactRequest.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<ContactRequest[]> {
    return db.contactRequest.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.ContactRequestCreateInput): Promise<ContactRequest> {
    return db.contactRequest.create({ data })
  }

  async update(id: string, data: Prisma.ContactRequestUpdateInput): Promise<ContactRequest> {
    return db.contactRequest.update({ where: { id }, data })
  }

  async delete(id: string): Promise<ContactRequest> {
    return db.contactRequest.delete({ where: { id } })
  }

  async count(where?: Prisma.ContactRequestWhereInput): Promise<number> {
    return db.contactRequest.count({ where })
  }

  async findWorkerWithCurator(id: string) {
    return db.worker.findUnique({
      where: { id },
      include: { curator: true },
    })
  }

  async createContactRequest(data: Prisma.ContactRequestUncheckedCreateInput) {
    return db.contactRequest.create({
      data,
      include: { fromUser: true, worker: true },
    })
  }

  async findContactRequests(workerId: string): Promise<ContactRequest[]> {
    return db.contactRequest.findMany({
      where: { workerId },
      include: { fromUser: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findContactRequestById(id: string): Promise<ContactRequest | null> {
    return db.contactRequest.findUnique({ where: { id } })
  }

  async updateContactRequestStatus(id: string, status: string) {
    return db.contactRequest.update({
      where: { id },
      data: { status: status as any },
      include: { fromUser: true, worker: true },
    })
  }
}

export const contactRequestRepository = new ContactRequestRepository()
