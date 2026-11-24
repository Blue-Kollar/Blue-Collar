// Closes #1855

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../utils/sanitize.js', () => ({
  sanitizeText: vi.fn((s: string) => s),
}));

vi.mock('../../utils/logger.js', () => ({
  createServiceLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
  })),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { createReviewService } from '../../services/review.service.js';
import { sanitizeText } from '../../utils/sanitize.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

type Review = {
  id: string;
  workerId: string;
  authorId: string;
  rating: number;
  body?: string;
  comment?: string | null;
  transactionHash?: string | null;
  isVerified: boolean;
  status: string;
  flagged?: boolean;
  flagReason?: string | null;
};

function makeReview(overrides: Partial<Review> = {}): Review {
  return {
    id: 'review-1',
    workerId: 'worker-1',
    authorId: 'author-1',
    rating: 5,
    body: 'Great work!',
    comment: null,
    transactionHash: 'tx-hash-123',
    isVerified: true,
    status: 'approved',
    ...overrides,
  };
}

/** Build a minimal fake review repository. */
function makeRepo() {
  return {
    findById: vi.fn(),
    findByUserAndWorker: vi.fn().mockResolvedValue(null),
    findWorkerReviews: vi.fn().mockResolvedValue([]),
    countReviews: vi.fn().mockResolvedValue(0),
    aggregateRating: vi.fn().mockResolvedValue({ _avg: { rating: null } }),
    groupByRating: vi.fn().mockResolvedValue([]),
    findWalletAddresses: vi.fn().mockResolvedValue({
      user: { walletAddress: null },
      worker: { walletAddress: null },
    }),
    createReview: vi.fn(),
    updateReview: vi.fn(),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('review.service', () => {
  let repo: ReturnType<typeof makeRepo>;
  let service: ReturnType<typeof createReviewService>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = makeRepo();
    service = createReviewService({ reviewRepository: repo as never });
  });

  // ── createReview ───────────────────────────────────────────────────────────

  describe('createReview', () => {
    it('creates a review on the happy path with a transactionHash', async () => {
      repo.findById.mockResolvedValueOnce({ id: 'worker-1' });
      const created = makeReview();
      repo.createReview.mockResolvedValueOnce(created);

      const result = await service.createReview(
        'worker-1',
        'author-1',
        5,
        'Great work!',
        undefined,
        'tx-hash-123',
      );

      expect(result).toEqual(created);
      expect(repo.createReview).toHaveBeenCalledOnce();
    });

    it('throws 400 when rating is less than 1', async () => {
      await expect(
        service.createReview('worker-1', 'author-1', 0, 'Too low'),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Rating') });
    });

    it('throws 400 when rating is greater than 5', async () => {
      await expect(
        service.createReview('worker-1', 'author-1', 6, 'Too high'),
      ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining('Rating') });
    });

    it('throws 400 when body is empty', async () => {
      await expect(service.createReview('worker-1', 'author-1', 4, '   ')).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('body'),
      });
    });

    it('throws 404 when the worker does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);

      await expect(
        service.createReview('ghost-worker', 'author-1', 4, 'Good job'),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 when the user has already reviewed this worker', async () => {
      repo.findById.mockResolvedValueOnce({ id: 'worker-1' });
      repo.findByUserAndWorker.mockResolvedValueOnce(makeReview());

      await expect(service.createReview('worker-1', 'author-1', 4, 'Again?')).rejects.toMatchObject(
        { statusCode: 409 },
      );
    });

    it('throws 403 when there is no on-chain interaction and no transactionHash', async () => {
      repo.findById.mockResolvedValueOnce({ id: 'worker-1' });
      repo.findByUserAndWorker.mockResolvedValueOnce(null);
      // No wallet addresses on either side → not verified
      repo.findWalletAddresses.mockResolvedValueOnce({
        user: { walletAddress: null },
        worker: { walletAddress: null },
      });

      await expect(
        // No transactionHash supplied
        service.createReview('worker-1', 'author-1', 4, 'Good job'),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it('sanitizes the comment field before storage', async () => {
      repo.findById.mockResolvedValueOnce({ id: 'worker-1' });
      repo.createReview.mockResolvedValueOnce(makeReview({ comment: 'clean comment' }));

      await service.createReview(
        'worker-1',
        'author-1',
        5,
        'Great work!',
        '<script>alert(1)</script>',
        'tx-hash-123',
      );

      expect(sanitizeText).toHaveBeenCalledWith('<script>alert(1)</script>');
    });
  });

  // ── listReviews ────────────────────────────────────────────────────────────

  describe('listReviews', () => {
    it('returns data, meta, averageRating, distribution with correct shape', async () => {
      const reviews = [makeReview()];
      repo.findWorkerReviews.mockResolvedValueOnce(reviews);
      repo.countReviews
        .mockResolvedValueOnce(1) // filtered count
        .mockResolvedValueOnce(1); // base count
      repo.aggregateRating.mockResolvedValueOnce({ _avg: { rating: 5 } });
      repo.groupByRating.mockResolvedValueOnce([{ rating: 5, _count: { rating: 1 } }]);

      const result = await service.listReviews('worker-1', 1, 10);

      expect(result.data).toHaveLength(1);
      expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10 });
      expect(result.averageRating).toBe(5);
      expect(result.distribution).toHaveLength(5);
      expect(result.distribution[0]).toMatchObject({ rating: 5, count: 1 });
    });

    it('returns null averageRating when there are no reviews', async () => {
      repo.findWorkerReviews.mockResolvedValueOnce([]);
      repo.countReviews.mockResolvedValue(0);
      repo.aggregateRating.mockResolvedValueOnce({ _avg: { rating: null } });
      repo.groupByRating.mockResolvedValueOnce([]);

      const result = await service.listReviews('worker-1', 1, 10);

      expect(result.averageRating).toBeNull();
    });
  });

  // ── flagReview ─────────────────────────────────────────────────────────────

  describe('flagReview', () => {
    it('throws 404 when the review does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);

      await expect(service.flagReview('ghost-review', 'spam')).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it('calls repo.updateReview with flagged: true', async () => {
      repo.findById.mockResolvedValueOnce(makeReview());
      repo.updateReview.mockResolvedValueOnce(makeReview({ flagged: true }));

      await service.flagReview('review-1', 'spam');

      expect(repo.updateReview).toHaveBeenCalledWith(
        'review-1',
        expect.objectContaining({ flagged: true }),
      );
    });
  });
});
