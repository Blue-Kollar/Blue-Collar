import type { Request, Response } from 'express'
import { db } from '../db.js'
import { sendModerationEmail } from '../mailer/index.js'

export async function listReviews(req: Request, res: Response) {
  const reviews = await db.review.findMany({
    where: { workerId: req.params.workerId, status: 'approved' },
    include: { author: { select: { id: true, firstName: true, lastName: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return res.json({ data: reviews, status: 'success', code: 200 })
}

export async function createReview(req: Request, res: Response) {
  const { workerId } = req.params
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) return res.status(404).json({ status: 'error', message: 'Worker not found', code: 404 })

  const { rating, comment } = req.body
  if (!rating || rating < 1 || rating > 5)
    return res.status(400).json({ status: 'error', message: 'rating must be 1-5', code: 400 })

  const flagged = isSpam(comment)
  const review = await db.review.create({
    data: {
      workerId,
      authorId: req.user!.id,
      rating: Number(rating),
      comment,
      flagged,
      status: flagged ? 'pending' : 'pending', // all go to moderation queue
    },
  })
  return res.status(201).json({ data: review, status: 'success', code: 201 })
}

export async function flagReview(req: Request, res: Response) {
  const review = await db.review.findUnique({ where: { id: req.params.id } })
  if (!review) return res.status(404).json({ status: 'error', message: 'Not found', code: 404 })

  const updated = await db.review.update({
    where: { id: req.params.id },
    data: { flagged: true, flagReason: req.body.reason ?? null, status: 'pending' },
  })
  return res.json({ data: updated, status: 'success', code: 200 })
}

export async function getModerationQueue(req: Request, res: Response) {
  const reviews = await db.review.findMany({
    where: { OR: [{ status: 'pending' }, { flagged: true }] },
    include: {
      worker: { select: { id: true, name: true } },
      author: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return res.json({ data: reviews, status: 'success', code: 200 })
}

export async function moderateReview(req: Request, res: Response) {
  const { action } = req.body // 'approve' | 'reject'
  if (!['approve', 'reject'].includes(action))
    return res.status(400).json({ status: 'error', message: 'action must be approve or reject', code: 400 })

  const review = await db.review.findUnique({
    where: { id: req.params.id },
    include: { author: true },
  })
  if (!review) return res.status(404).json({ status: 'error', message: 'Not found', code: 404 })

  const status = action === 'approve' ? 'approved' : 'rejected'
  const updated = await db.review.update({
    where: { id: req.params.id },
    data: { status, flagged: false },
  })

  // Notify author
  if (review.author.email) {
    await sendModerationEmail(review.author.email, review.author.firstName, status).catch(() => {})
  }

  return res.json({ data: updated, status: 'success', code: 200 })
}

// Simple spam detection: repeated chars, all-caps, known spam phrases
function isSpam(text?: string): boolean {
  if (!text) return false
  if (text.length > 2000) return true
  if (/(.)\1{9,}/.test(text)) return true // 10+ repeated chars
  if (text === text.toUpperCase() && text.length > 20) return true // all caps
  const spamPhrases = ['buy now', 'click here', 'free money', 'make money fast']
  return spamPhrases.some(p => text.toLowerCase().includes(p))
}
