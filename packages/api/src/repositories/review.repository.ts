import type { Review, Prisma, PrismaClient } from '@prisma/client'
import type { IRepository } from './base.repository.js'
import { db } from '@/db.js'

// ── Transaction client ────────────────────────────────────────────────────────

/**
 * Minimal Prisma client surface required by write methods. Accepting this
 * (instead of the full PrismaClient) lets callers pass either the global
 * client or a `Prisma.TransactionClient` from `db.$transaction`, so multi-step
 * writes can be wrapped atomically (#1814).
 */
export type ReviewTxClient = Pick<PrismaClient, 'review'>

// ── Interface ─────────────────────────────────────────────────────────────────

export interface IReviewRepository extends IRepository<Review, Prisma.ReviewCreateInput, Prisma.ReviewUpdateInput> {
  findByUserAndWorker(userId: string, workerId: string): Promise<Review | null>
  findWorkerReviews(where: Prisma.ReviewWhereInput, opts: { skip: number; take: number }): Promise<Review[]>
  findWorkerReviewsWithStats(
    where: Prisma.ReviewWhereInput,
    opts: { skip: number; take: number },
  ): Promise<{
    reviews: Review[]
    total: number
    averageRating: number | null
    ratingCounts: { rating: number; count: number }[]
  }>
  countReviews(where: Prisma.ReviewWhereInput): Promise<number>
  aggregateRating(where: Prisma.ReviewWhereInput): Promise<{ _avg: { rating: number | null } }>
  groupByRating(where: Prisma.ReviewWhereInput): Promise<{ rating: number; _count: { rating: number } }[]>
  findWalletAddresses(userId: string, workerId: string): Promise<{
    user: { walletAddress: string | null } | null
    worker: { walletAddress: string | null } | null
  }>
  createReview(data: Prisma.ReviewUncheckedCreateInput, tx?: ReviewTxClient): Promise<Review>
  updateReview(id: string, data: Prisma.ReviewUpdateInput, tx?: ReviewTxClient): Promise<Review>
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

  async create(data: Prisma.ReviewCreateInput, tx?: ReviewTxClient): Promise<Review> {
    return (tx ?? db).review.create({ data })
  }

  async update(id: string, data: Prisma.ReviewUpdateInput, tx?: ReviewTxClient): Promise<Review> {
    return (tx ?? db).review.update({ where: { id }, data })
  }

  async delete(id: string, tx?: ReviewTxClient): Promise<Review> {
    return (tx ?? db).review.delete({ where: { id } })
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

  /**
   * Batched variant: fetches the page of reviews together with total count,
   * average rating and per-rating counts in a single round-trip, avoiding the
   * N+1 pattern of issuing separate count/aggregate queries per worker (#1813).
   */
  async findWorkerReviewsWithStats(
    where: Prisma.ReviewWhereInput,
    opts: { skip: number; take: number },
  ): Promise<{
    reviews: Review[]
    total: number
    averageRating: number | null
    ratingCounts: { rating: number; count: number }[]
  }> {
    const [reviews, total, aggregate, grouped] = await Promise.all([
      db.review.findMany({ where, skip: opts.skip, take: opts.take, orderBy: { createdAt: 'desc' }, include: authorSelect }),
      db.review.count({ where }),
      db.review.aggregate({ where, _avg: { rating: true } }),
      db.review.groupBy({ by: ['rating'], where, _count: { rating: true } }),
    ])

    return {
      reviews,
      total,
      averageRating: aggregate._avg.rating,
      ratingCounts: grouped.map((g) => ({ rating: g.rating, count: g._count.rating })),
    }
  }

  async countReviews(where: Prisma.ReviewWhereInput): Promise<number> {
    return db.review.count({ where })
  }

  async aggregateRating(where: Prisma.ReviewWhereInput): Promise<{ _avg: { rating: number | null } }> {
    return db.review.aggregate({ where, _avg: { rating: true } })
  }

  async groupByRating(where: Prisma.ReviewWhereInput): Promise<{ rating: number; _count: { rating: number } }[]> {
    const result = await db.review.groupBy({ by: ['rating'], where, _count: { rating: true } })
    return result
  }

  async findWalletAddresses(userId: string, workerId: string) {
    const [user, worker] = await Promise.all([
      db.user.findUnique({ where: { id: userId }, select: { walletAddress: true } }),
      db.worker.findUnique({ where: { id: workerId }, select: { walletAddress: true } }),
    ])
    return { user, worker }
  }

  async createReview(data: Prisma.ReviewUncheckedCreateInput, tx?: ReviewTxClient): Promise<Review> {
    return (tx ?? db).review.create({ data, include: authorSelect })
  }

  async updateReview(id: string, data: Prisma.ReviewUpdateInput, tx?: ReviewTxClient): Promise<Review> {
    return (tx ?? db).review.update({ where: { id }, data })
  }
}

export const reviewRepository = new ReviewRepository()
