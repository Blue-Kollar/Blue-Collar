/**
 * Unit tests for src/services/review.service.ts
 * All DB and mailer calls are mocked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

process.env.JWT_SECRET = 'test-secret'

vi.mock('../db.js', () => ({
  db: {
    worker: { findUnique: vi.fn() },
    review: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}))

vi.mock('../mailer/index.js', () => ({
  sendModerationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../config/env.js', () => ({
  env: { JWT_SECRET: 'test-secret' },
}))

import { db } from '../db.js'
import { sendModerationEmail } from '../mailer/index.js'
import {
  isSpam,
  createReview,
  listReviews,
  listWorkerReviews,
  flagReview,
  getModerationQueue,
  moderateReview,
  deleteReview,
} from '../services/review.service.js'

// ─── isSpam ───────────────────────────────────────────────────────────────────

describe('isSpam', () => {
  it('returns false for normal review text', () => {
    expect(isSpam('Great plumber, arrived on time!')).toBe(false)
  })

  it('returns false for undefined input', () => {
    expect(isSpam(undefined)).toBe(false)
  })

  it('returns true for text exceeding 2000 chars', () => {
    expect(isSpam('a'.repeat(2001))).toBe(true)
  })

  it('returns true when a character repeats 10+ times in a row', () => {
    expect(isSpam('aaaaaaaaaa')).toBe(true) // 10 a's
  })

  it('returns false when a character repeats only 9 times', () => {
    expect(isSpam('aaaaaaaaa')).toBe(false) // 9 a's
  })

  it('returns true for all-caps text longer than 20 chars', () => {
    expect(isSpam('THIS IS ALL CAPS AND IT IS VERY LONG')).toBe(true)
  })

  it('returns false for all-caps text 20 chars or shorter', () => {
    expect(isSpam('SHORT CAPS')).toBe(false)
  })

  it('returns true for known spam phrases', () => {
    expect(isSpam('click here for more info')).toBe(true)
    expect(isSpam('buy now and save')).toBe(true)
    expect(isSpam('free money awaits')).toBe(true)
    expect(isSpam('make money fast online')).toBe(true)
  })

  it('is case-insensitive for spam phrases', () => {
    expect(isSpam('CLICK HERE')).toBe(true)
  })
})

// ─── createReview ─────────────────────────────────────────────────────────────

describe('createReview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates a review successfully', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)
    vi.mocked(db.review.create).mockResolvedValue({
      id: 'review-1',
      workerId: 'worker-1',
      authorId: 'user-1',
      rating: 4,
      body: 'Good job',
    } as never)

    const result = await createReview('worker-1', 'user-1', 4, 'Good job')

    expect(result).toMatchObject({ id: 'review-1', rating: 4 })
    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workerId: 'worker-1',
        authorId: 'user-1',
        userId: 'user-1',
        rating: 4,
        body: 'Good job',
      }),
    }))
  })

  it('throws 404 when worker not found', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue(null as never)

    await expect(createReview('missing-worker', 'user-1', 5, 'Great')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Worker not found',
    })
  })

  it('throws 400 for rating below 1', async () => {
    await expect(createReview('worker-1', 'user-1', 0, 'Ok')).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 400 for rating above 5', async () => {
    await expect(createReview('worker-1', 'user-1', 6, 'Too good')).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 400 for empty body', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)

    await expect(createReview('worker-1', 'user-1', 5, '   ')).rejects.toMatchObject({
      statusCode: 400,
    })
  })

  it('throws 409 on duplicate review (P2002)', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)
    vi.mocked(db.review.create).mockRejectedValue({ code: 'P2002' })

    await expect(createReview('worker-1', 'user-1', 5, 'Great')).rejects.toMatchObject({
      statusCode: 409,
      message: 'You have already reviewed this worker',
    })
  })

  it('flags spam reviews automatically', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValue({ id: 'worker-1' } as never)
    vi.mocked(db.review.create).mockResolvedValue({ id: 'review-1' } as never)

    await createReview('worker-1', 'user-1', 5, 'click here to win big')

    expect(db.review.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ flagged: true }),
    }))
  })
})

// ─── listWorkerReviews ────────────────────────────────────────────────────────

describe('listWorkerReviews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns reviews and aggregate stats', async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([
      { id: 'r1', rating: 5 },
      { id: 'r2', rating: 4 },
    ] as never)
    vi.mocked(db.review.aggregate).mockResolvedValue({
      _avg: { rating: 4.5 },
      _count: { rating: 2 },
    } as never)

    const result = await listWorkerReviews('worker-1')

    expect(result.data).toHaveLength(2)
    expect(result.avgRating).toBe(4.5)
    expect(result.reviewCount).toBe(2)
  })

  it('returns empty when no reviews', async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([] as never)
    vi.mocked(db.review.aggregate).mockResolvedValue({
      _avg: { rating: null },
      _count: { rating: 0 },
    } as never)

    const result = await listWorkerReviews('worker-1')

    expect(result.data).toHaveLength(0)
    expect(result.avgRating).toBe(0)
    expect(result.reviewCount).toBe(0)
  })
})

// ─── listReviews (paginated) ──────────────────────────────────────────────────

describe('listReviews', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated reviews with distribution', async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([{ id: 'r1', rating: 5 }] as never)
    vi.mocked(db.review.count).mockResolvedValue(1 as never)
    vi.mocked(db.review.aggregate).mockResolvedValue({ _avg: { rating: 5 } } as never)
    vi.mocked(db.review.groupBy).mockResolvedValue([{ rating: 5, _count: { rating: 1 } }] as never)

    const result = await listReviews('worker-1', 1, 10)

    expect(result.data).toHaveLength(1)
    expect(result.meta.total).toBe(1)
    expect(result.meta.page).toBe(1)
    expect(result.averageRating).toBe(5)
    expect(result.distribution).toHaveLength(5)
  })
})

// ─── flagReview ───────────────────────────────────────────────────────────────

describe('flagReview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('flags a review with a reason', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({ id: 'review-1', status: 'approved' } as never)
    vi.mocked(db.review.update).mockResolvedValue({
      id: 'review-1',
      flagged: true,
      flagReason: 'inappropriate',
      status: 'pending',
    } as never)

    const result = await flagReview('review-1', 'inappropriate')

    expect(result).toMatchObject({ flagged: true, flagReason: 'inappropriate' })
    expect(db.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { flagged: true, flagReason: 'inappropriate', status: 'pending' },
    })
  })

  it('flags a review without a reason', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({ id: 'review-1' } as never)
    vi.mocked(db.review.update).mockResolvedValue({ id: 'review-1', flagged: true } as never)

    await flagReview('review-1')

    expect(db.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { flagged: true, flagReason: null, status: 'pending' },
    })
  })

  it('throws 404 for a non-existent review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(null as never)

    await expect(flagReview('missing-id')).rejects.toMatchObject({ statusCode: 404 })
  })
})

// ─── getModerationQueue ───────────────────────────────────────────────────────

describe('getModerationQueue', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns pending and flagged reviews', async () => {
    const mockReviews = [
      { id: 'r1', status: 'pending', flagged: false },
      { id: 'r2', status: 'approved', flagged: true },
    ]
    vi.mocked(db.review.findMany).mockResolvedValue(mockReviews as never)

    const result = await getModerationQueue()

    expect(result).toHaveLength(2)
    expect(db.review.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { OR: [{ status: 'pending' }, { flagged: true }] },
    }))
  })

  it('returns empty array when no items in queue', async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([] as never)

    const result = await getModerationQueue()

    expect(result).toHaveLength(0)
  })
})

// ─── moderateReview ───────────────────────────────────────────────────────────

describe('moderateReview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('approves a review and sends notification email', async () => {
    const mockReview = {
      id: 'review-1',
      author: { email: 'user@example.com', firstName: 'Alice' },
    }
    vi.mocked(db.review.findUnique).mockResolvedValue(mockReview as never)
    vi.mocked(db.review.update).mockResolvedValue({ id: 'review-1', status: 'approved' } as never)

    const result = await moderateReview('review-1', 'approve')

    expect(result).toMatchObject({ status: 'approved' })
    expect(db.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { status: 'approved', flagged: false },
    })
    expect(sendModerationEmail).toHaveBeenCalledWith(
      'user@example.com',
      'Alice',
      'approved',
    )
  })

  it('rejects a review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({
      id: 'review-1',
      author: { email: 'user@example.com', firstName: 'Bob' },
    } as never)
    vi.mocked(db.review.update).mockResolvedValue({ id: 'review-1', status: 'rejected' } as never)

    const result = await moderateReview('review-1', 'reject')

    expect(result).toMatchObject({ status: 'rejected' })
  })

  it('throws 400 for invalid action', async () => {
    await expect(moderateReview('review-1', 'delete' as 'approve')).rejects.toMatchObject({
      statusCode: 400,
      message: 'action must be approve or reject',
    })
  })

  it('throws 404 for non-existent review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(null as never)

    await expect(moderateReview('missing-id', 'approve')).rejects.toMatchObject({
      statusCode: 404,
    })
  })

  it('does not fail if author has no email', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({
      id: 'review-1',
      author: { firstName: 'Anonymous' }, // no email
    } as never)
    vi.mocked(db.review.update).mockResolvedValue({ id: 'review-1', status: 'approved' } as never)

    await expect(moderateReview('review-1', 'approve')).resolves.toBeTruthy()
    expect(sendModerationEmail).not.toHaveBeenCalled()
  })
})

// ─── deleteReview ─────────────────────────────────────────────────────────────

describe('deleteReview', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes a review owned by the requesting user (userId)', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({
      id: 'review-1',
      userId: 'user-1',
      authorId: 'user-1',
    } as never)
    vi.mocked(db.review.delete).mockResolvedValue({ id: 'review-1' } as never)

    await deleteReview('review-1', 'user-1')

    expect(db.review.delete).toHaveBeenCalledWith({ where: { id: 'review-1' } })
  })

  it('deletes a review when userId is null but authorId matches', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({
      id: 'review-1',
      userId: null,
      authorId: 'user-1',
    } as never)
    vi.mocked(db.review.delete).mockResolvedValue({ id: 'review-1' } as never)

    await deleteReview('review-1', 'user-1')

    expect(db.review.delete).toHaveBeenCalledWith({ where: { id: 'review-1' } })
  })

  it('throws 403 when user does not own the review', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({
      id: 'review-1',
      userId: 'user-2',
      authorId: 'user-2',
    } as never)

    await expect(deleteReview('review-1', 'user-1')).rejects.toMatchObject({
      statusCode: 403,
      message: 'Forbidden',
    })
    expect(db.review.delete).not.toHaveBeenCalled()
  })

  it('throws 404 when review does not exist', async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(null as never)

    await expect(deleteReview('missing-id', 'user-1')).rejects.toMatchObject({
      statusCode: 404,
      message: 'Review not found',
    })
  })
})
