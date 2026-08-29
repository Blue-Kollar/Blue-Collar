import type { Bookmark, Prisma, Worker } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IBookmarkRepository extends IRepository<Bookmark, Prisma.BookmarkCreateInput, Prisma.BookmarkUpdateInput> {
  findByUserAndWorker(userId: string, workerId: string): Promise<Bookmark | null>
  createBookmark(userId: string, workerId: string): Promise<Bookmark>
  deleteBookmark(id: string): Promise<Bookmark>
  findWorkerById(id: string): Promise<Worker | null>
  findUserBookmarks(userId: string, opts: { skip: number; take: number }): Promise<{ data: Bookmark[]; total: number }>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

export class BookmarkRepository implements IBookmarkRepository {
  async findById(id: string): Promise<Bookmark | null> {
    return db.bookmark.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Bookmark[]> {
    return db.bookmark.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.BookmarkCreateInput): Promise<Bookmark> {
    return db.bookmark.create({ data })
  }

  async update(id: string, data: Prisma.BookmarkUpdateInput): Promise<Bookmark> {
    return db.bookmark.update({ where: { id }, data })
  }

  async delete(id: string): Promise<Bookmark> {
    return db.bookmark.delete({ where: { id } })
  }

  async count(where?: Prisma.BookmarkWhereInput): Promise<number> {
    return db.bookmark.count({ where })
  }

  async findByUserAndWorker(userId: string, workerId: string): Promise<Bookmark | null> {
    return db.bookmark.findUnique({ where: { userId_workerId: { userId, workerId } } })
  }

  async createBookmark(userId: string, workerId: string): Promise<Bookmark> {
    return db.bookmark.create({ data: { userId, workerId } })
  }

  async deleteBookmark(id: string): Promise<Bookmark> {
    return db.bookmark.delete({ where: { id } })
  }

  async findWorkerById(id: string): Promise<Worker | null> {
    return db.worker.findUnique({ where: { id } })
  }

  async findUserBookmarks(userId: string, opts: { skip: number; take: number }): Promise<{ data: Bookmark[]; total: number }> {
    const where = { userId }
    const [data, total] = await Promise.all([
      db.bookmark.findMany({
        where,
        skip: opts.skip,
        take: opts.take,
        orderBy: { createdAt: 'desc' },
        include: { worker: { include: { category: true } } },
      }),
      db.bookmark.count({ where }),
    ])
    return { data, total }
  }
}

export const bookmarkRepository = new BookmarkRepository()
