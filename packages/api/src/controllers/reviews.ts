import type { Request, Response } from 'express'
import { db } from '../db.js'
import { sendModerationEmail } from '../mailer/index.js'
import * as reviewService from '../services/review.service.js'
import { AppError } from '../services/AppError.js'
import { catchAsync } from '../utils/catchAsync.js'
import { createPaginationHelper } from '../utils/pagination.js'

export const listReviews = catchAsync(async (req: Request, res: Response) => {
  const { workerId } = req.params
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20)
  const filterRating = req.query.rating ? parseInt(req.query.rating as string) : undefined

  const result = await reviewService.listReviews(workerId, page, limit, filterRating)
  res.json({ data: result.data, meta: result.meta, stats: { averageRating: result.averageRating, reviewCount: result.reviewCount, verified: result.verified, distribution: result.distribution }, status: 'success', code: 200 })
})

export const createReview = catchAsync(async (req: Request, res: Response) => {
  const { workerId } = req.params
  const { rating, comment, transactionHash } = req.body

  const review = await reviewService.createReview(workerId, req.user!.id, rating, comment, transactionHash)
  res.status(201).json({ data: review, status: 'success', message: 'Review created (pending moderation)', code: 201 })
})

export const flagReview = catchAsync(async (req: Request, res: Response) => {
  const { reason } = req.body
  if (!reason) throw new AppError('reason is required', 400)

  const review = await reviewService.flagReview(req.params.id, reason)
  res.json({ data: review, status: 'success', message: 'Review flagged', code: 200 })
})

export const getModerationQueue = catchAsync(async (req: Request, res: Response) => {
  const { page, limit, skip, take, buildMeta } = createPaginationHelper(req.query, {
    maxLimit: 100,
    defaultLimit: 20,
  })

  const [reviews, total] = await Promise.all([
    db.review.findMany({
      where: { OR: [{ status: 'pending' }, { flagged: true }] },
      include: {
        worker: { select: { id: true, name: true } },
        author: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
    db.review.count({
      where: { OR: [{ status: 'pending' }, { flagged: true }] },
    }),
  ])

  res.json({ data: reviews, meta: buildMeta(total), status: 'success', code: 200 })
})

export const moderateReview = catchAsync(async (req: Request, res: Response) => {
  const { action } = req.body // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action))
    throw new AppError('action must be approve or reject', 400)

  const review = await db.review.findUnique({
    where: { id: req.params.id },
    include: { author: true },
  })
  if (!review) throw new AppError('Review not found', 404)

  const updated = action === 'approve'
    ? await reviewService.approveReview(req.params.id)
    : await reviewService.rejectReview(req.params.id)

  // Notify author
  if (review.author.email) {
    await sendModerationEmail(review.author.email, review.author.firstName, updated.status).catch(() => {})
  }

  res.json({ data: updated, status: 'success', message: `Review ${action}ed`, code: 200 })
})

export const getReviewReports = catchAsync(async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1)
  const limit = Math.min(100, parseInt(req.query.limit as string) || 20)

  const [reports, total] = await Promise.all([
    db.review.findMany({
      where: { flagged: true },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        worker: { select: { id: true, name: true } },
        author: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.review.count({ where: { flagged: true } }),
  ])

  res.json({
    data: reports,
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
    status: 'success',
    code: 200,
  })
})

export const reportReview = catchAsync(async (req: Request, res: Response) => {
  const { reason } = req.body
  if (!reason) throw new AppError('reason is required', 400)

  const review = await reviewService.flagReview(req.params.reviewId, reason)
  res.json({ data: review, status: 'success', message: 'Review reported', code: 200 })
})
