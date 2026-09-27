import type { Bookmark, Category, Prisma, Worker } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { BaseRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IBookmarkRepository extends IRepository<Bookmark, Prisma.BookmarkCreateInput, Prisma.BookmarkUpdateInput> {
  findByUserAndWorker(userId: string, workerId: string): Promise<Bookmark | null>
  createBookmark(userId: string, workerId: string): Promise<Bookmark>
  deleteBookmark(id: string): Promise<Bookmark>
  findWorkerById(id: string): Promise<Worker | null>
  findUserBookmarks(userId: string, opts: { skip: number; take: number }): Promise<{ data: (Bookmark & { worker: Worker & { category: Category } })[]; total: number }>
}

// ── Prisma implementation ─────────────────────────────────────────────────────
// CRUD boilerplate lives in BaseRepository; bookmarks are hard-deleted
// (no deletedAt column) so softDelete stays off.

export class BookmarkRepository extends BaseRepository<Bookmark, Prisma.BookmarkCreateInput, Prisma.BookmarkUpdateInput, Prisma.BookmarkWhereInput> implements IBookmarkRepository {
  constructor() {
    super(db.bookmark)
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

  async findUserBookmarks(userId: string, opts: { skip: number; take: number }) {
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
