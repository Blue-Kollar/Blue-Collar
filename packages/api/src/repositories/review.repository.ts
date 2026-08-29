import type { Review, Prisma } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '../db.js'

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IReviewRepository extends IRepository<Review, Prisma.ReviewCreateInput, Prisma.ReviewUpdateInput> {
  findByUserAndWorker(userId: string, workerId: string): Promise<Review | null>
  findWorkerReviews(where: Prisma.ReviewWhereInput, opts: { skip: number; take: number }): Promise<Review[]>
  countReviews(where: Prisma.ReviewWhereInput): Promise<number>
  aggregateRating(where: Prisma.ReviewWhereInput): Promise<{ _avg: { rating: number | null } }>
  groupByRating(where: Prisma.ReviewWhereInput): Promise<{ rating: number; _count: { rating: number } }[]>
  findWalletAddresses(userId: string, workerId: string): Promise<{
    user: { walletAddress: string | null } | null
    worker: { walletAddress: string | null } | null
  }>
  createReview(data: Prisma.ReviewUncheckedCreateInput): Promise<Review>
  updateReview(id: string, data: Prisma.ReviewUpdateInput): Promise<Review>
}

// ── Prisma implementation ─────────────────────────────────────────────────────

const authorSelect = { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } } as const

export class ReviewRepository implements IReviewRepository {
  async findById(id: string): Promise<Review | null> {
    return db.review.findUnique({ where: { id } })
  }

  async findAll(opts: { skip?: number; take?: number } = {}): Promise<Review[]> {
    return db.review.findMany({ skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' } })
  }

  async create(data: Prisma.ReviewCreateInput): Promise<Review> {
    return db.review.create({ data })
  }

  async update(id: string, data: Prisma.ReviewUpdateInput): Promise<Review> {
    return db.review.update({ where: { id }, data })
  }

  async delete(id: string): Promise<Review> {
    return db.review.delete({ where: { id } })
  }

  async count(where?: Prisma.ReviewWhereInput): Promise<number> {
    return db.review.count({ where })
  }

  async findByUserAndWorker(userId: string, workerId: string): Promise<Review | null> {
    return db.review.findUnique({ where: { userId_workerId: { userId, workerId } } })
  }

  async findWorkerReviews(where: Prisma.ReviewWhereInput, opts: { skip: number; take: number }): Promise<Review[]> {
    return db.review.findMany({ where, skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' }, include: authorSelect })
  }

  async countReviews(where: Prisma.ReviewWhereInput): Promise<number> {
    return db.review.count({ where })
  }

  async aggregateRating(where: Prisma.ReviewWhereInput): Promise<{ _avg: { rating: number | null } }> {
    return db.review.aggregate({ where, _avg: { rating: true } })
  }

  async groupByRating(where: Prisma.ReviewWhereInput): Promise<{ rating: number; _count: { rating: number } }[]> {
    return db.review.groupBy({ by: ['rating'], where, _count: { rating: true } })
  }

  async findWalletAddresses(userId: string, workerId: string) {
    const [user, worker] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { walletAddress: true } }),
      db.worker.findUnique({ where: { id: workerId }, select: { walletAddress: true } }),
    ])
    return { user, worker }
  }

  async createReview(data: Prisma.ReviewUncheckedCreateInput): Promise<Review> {
    return db.review.create({ data, include: authorSelect })
  }

  async updateReview(id: string, data: Prisma.ReviewUpdateInput): Promise<Review> {
    return db.review.update({ where: { id }, data })
  }
}

export const reviewRepository = new ReviewRepository()
