import { reviewRepository as defaultReviewRepository } from '../repositories/review.repository.js'
import { AppError } from './AppError.js'
import { createServiceLogger } from '../utils/logger.js'
import type { ReviewServiceDeps } from '../container/types.js'

const logger = createServiceLogger('ReviewService')

// ── Factory ───────────────────────────────────────────────────────────────────

export function createReviewService(deps: ReviewServiceDeps) {
  const { reviewRepository: repo } = deps

  async function verifyOnChainTransaction(userId: string, workerId: string, transactionHash?: string): Promise<boolean> {
    if (transactionHash) {
      logger.debug('Verifying transaction hash', { transactionHash })
      return true
    }

    const { user, worker } = await repo.findWalletAddresses(userId, workerId)
    return !!(user?.walletAddress && worker?.walletAddress)
  }

  return {
    /**
     * Create a review for a worker. A user may only review a worker once.
     */
    async createReview(
      workerId: string,
      authorId: string,
      rating: number,
      body: string,
      comment?: string,
      transactionHash?: string,
    ) {
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        throw new AppError('Rating must be between 1 and 5', 400)
      }

      if (!body || !body.trim()) {
        throw new AppError('Review body is required', 400)
      }

      const worker = await repo.findById(workerId)
      if (!worker) throw new AppError('Worker not found', 404)

      const existing = await repo.findByUserAndWorker(authorId, workerId)
      if (existing) throw new AppError('You have already reviewed this worker', 409)

      const isVerified = await verifyOnChainTransaction(authorId, workerId, transactionHash)
      if (!isVerified && !transactionHash) {
        throw new AppError('You must have an on-chain interaction with this worker to leave a review', 403)
      }

      logger.info('Creating review', { workerId, authorId, rating, isVerified })

      return repo.createReview({
        workerId,
        authorId,
        rating,
        comment,
        transactionHash,
        isVerified,
        status: 'pending',
      } as any)
    },

    /**
     * Return a paginated list of reviews for a worker, plus aggregate stats and rating distribution.
     */
    async listReviews(workerId: string, page: number, limit: number, filterRating?: number) {
      const where = { workerId, status: 'approved', ...(filterRating ? { rating: filterRating } : {}) }
      const baseWhere = { workerId, status: 'approved' }

      const [reviews, total, agg, allRatings] = await Promise.all([
        repo.findWorkerReviews(where, { skip: (page - 1) * limit, take: limit }),
        repo.countReviews(where),
        repo.aggregateRating(baseWhere),
        repo.groupByRating(baseWhere),
      ])

      const totalReviews = await repo.countReviews(baseWhere)

      const distribution = [5, 4, 3, 2, 1].map((star) => {
        const entry = allRatings.find((r) => r.rating === star)
        const count = entry?._count.rating ?? 0
        return {
          rating: star,
          count,
          percentage: totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0,
        }
      })

      return {
        data: reviews,
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
        averageRating: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
        reviewCount: totalReviews,
        distribution,
        verified: reviews.filter((r: any) => r.isVerified).length,
      }
    },

    /**
     * Flag a review for moderation.
     */
    async flagReview(reviewId: string, reason: string) {
      const review = await repo.findById(reviewId)
      if (!review) throw new AppError('Review not found', 404)
      return repo.updateReview(reviewId, { flagged: true, flagReason: reason } as any)
    },

    /**
     * Approve a pending review (admin/moderator).
     */
    async approveReview(reviewId: string) {
      const review = await repo.findById(reviewId)
      if (!review) throw new AppError('Review not found', 404)
      return repo.updateReview(reviewId, { status: 'approved' } as any)
    },

    /**
     * Reject a review (admin/moderator).
     */
    async rejectReview(reviewId: string, reason?: string) {
      const review = await repo.findById(reviewId)
      if (!review) throw new AppError('Review not found', 404)
      return repo.updateReview(reviewId, { status: 'rejected', flagReason: reason } as any)
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createReviewService({
  reviewRepository: defaultReviewRepository,
})

export async function createReview(
  workerId: string,
  authorId: string,
  rating: number,
  body: string,
  comment?: string,
  transactionHash?: string,
) {
  return _defaultService.createReview(workerId, authorId, rating, body, comment, transactionHash)
}

export async function listReviews(workerId: string, page: number, limit: number, filterRating?: number) {
  return _defaultService.listReviews(workerId, page, limit, filterRating)
}

export async function flagReview(reviewId: string, reason: string) {
  return _defaultService.flagReview(reviewId, reason)
}

export async function approveReview(reviewId: string) {
  return _defaultService.approveReview(reviewId)
}

export async function rejectReview(reviewId: string, reason?: string) {
  return _defaultService.rejectReview(reviewId, reason)
}
