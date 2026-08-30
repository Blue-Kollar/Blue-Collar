/**
 * API contract tests — validate the actual API response shapes against the
 * canonical contract schemas in ./responseSchemas.ts at RUNTIME (not just at
 * compile time). The serializers exercised here are exactly what the route
 * controllers return, so this catches response-shape drift that would otherwise
 * only surface in production clients.
 *
 * No database or network is required: the serializers are pure functions and are
 * fed representative fixtures.
 *
 * Run: pnpm --filter @bluecollar/api test:contract
 */
import { describe, it, expect } from 'vitest';
import { categorySerializer } from '../../serializers/category.serializer.js';
import { userSerializer } from '../../serializers/user.serializer.js';
import { reviewSerializer } from '../../serializers/review.serializer.js';
import { workerSerializer } from '../../serializers/worker.serializer.js';
import {
  ApiEnvelopeSchema,
  CategorySchema,
  SerializedUserSchema,
  SerializedReviewSchema,
  SerializedWorkerSchema,
  PaginatedSchema,
  AccountInfoSchema,
} from './responseSchemas.js';

// ── Fixtures (representative Prisma-shaped records) ───────────────────────────

const categoryFixture = {
  id: 'cat_1',
  name: 'Plumber',
  description: 'Pipe fixing',
  icon: 'droplets',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

const userFixture = {
  id: 'usr_1',
  email: 'worker@example.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  role: 'user' as const,
  verified: true,
  avatar: null,
  // PII / secret fields the serializer MUST strip
  password: 'super-secret',
  verificationToken: 'vt',
  verificationTokenExpiry: new Date(),
  resetToken: 'rt',
  resetTokenExpiry: new Date(),
  twoFactorSecret: '2fa',
  twoFactorBackupCodes: ['x'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

const reviewFixture = {
  id: 'rev_1',
  rating: 5,
  comment: 'Great work',
  workerId: 'w_1',
  authorId: 'usr_2',
  createdAt: '2026-02-01T00:00:00Z',
  author: {
    id: 'usr_2',
    firstName: 'Grace',
    lastName: 'Hopper',
    avatar: null,
  },
};

const workerFixture = {
  id: 'w_1',
  name: 'Bob Builder',
  bio: 'Reliable',
  avatar: 'avatar.png',
  location: 'Lisbon',
  latitude: 38.7,
  longitude: -9.1,
  isVerified: true,
  isActive: true,
  locationId: 'loc_1',
  walletAddress: 'GABC123',
  categoryId: 'cat_1',
  imageThumb: 't.jpg',
  imageMedium: 'm.jpg',
  imageFull: 'f.jpg',
  averageRating: 4.5,
  reviewCount: 12,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  category: categoryFixture,
};

// ── Category ──────────────────────────────────────────────────────────────────

describe('API contract — Category', () => {
  it('serialized category matches the contract schema', () => {
    const result = categorySerializer.serialize(categoryFixture as never);
    expect(CategorySchema.safeParse(result).success).toBe(true);
  });
});

// ── User ──────────────────────────────────────────────────────────────────────

describe('API contract — User (sanitised)', () => {
  it('serialized user matches the contract schema and strips secrets', () => {
    const result = userSerializer.serialize(userFixture as never);
    expect(SerializedUserSchema.safeParse(result).success).toBe(true);
    // PII / credentials must never leak into the public response
    expect(result).not.toHaveProperty('password');
    expect(result).not.toHaveProperty('verificationToken');
    expect(result).not.toHaveProperty('twoFactorSecret');
  });
});

// ── Review ────────────────────────────────────────────────────────────────────

describe('API contract — Review', () => {
  it('serialized review (with author) matches the contract schema', () => {
    const result = reviewSerializer.serialize(reviewFixture as never);
    expect(SerializedReviewSchema.safeParse(result).success).toBe(true);
  });

  it('review without an author still validates (author optional)', () => {
    const { author, ...rest } = reviewFixture;
    const result = reviewSerializer.serialize(rest as never);
    expect(SerializedReviewSchema.safeParse(result).success).toBe(true);
  });
});

// ── Worker ────────────────────────────────────────────────────────────────────

describe('API contract — Worker', () => {
  it('serialized worker matches the contract schema and emits images (not portfolioImages)', () => {
    const result = workerSerializer.serialize(workerFixture as never);
    expect(SerializedWorkerSchema.safeParse(result).success).toBe(true);
    // PII is intentionally stripped from the public worker contract
    expect(result).not.toHaveProperty('phone');
    expect(result).not.toHaveProperty('email');
    expect(result.images).toEqual({ thumb: 't.jpg', medium: 'm.jpg', full: 'f.jpg' });
  });

  it('worker without a category still validates (category optional)', () => {
    const { category, ...rest } = workerFixture;
    const result = workerSerializer.serialize(rest as never);
    expect(SerializedWorkerSchema.safeParse(result).success).toBe(true);
  });
});

// ── Envelope + pagination ──────────────────────────────────────────────────────

describe('API contract — envelope & pagination', () => {
  it('wraps a list response in a valid paginated envelope', () => {
    const body = {
      data: [categorySerializer.serialize(categoryFixture as never)],
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    };
    expect(PaginatedSchema(CategorySchema).safeParse(body).success).toBe(true);
  });

  it('produces a well-formed success envelope for a single entity', () => {
    const body = {
      status: 'success' as const,
      code: 200,
      data: userSerializer.serialize(userFixture as never),
    };
    expect(ApiEnvelopeSchema.safeParse(body).success).toBe(true);
  });
});

// ── AccountInfo (Stellar wallet response) ─────────────────────────────────────

describe('API contract — AccountInfo', () => {
  it('validates a well-formed account info object', () => {
    const accountInfo = { publicKey: 'GABC', balance: 12.5, sequence: 42n };
    expect(AccountInfoSchema.safeParse(accountInfo).success).toBe(true);
  });
});

// ── Negative test: drift detection ────────────────────────────────────────────

describe('API contract — drift detection', () => {
  it('FAILS validation when a required field is missing (proves the contract is enforced)', () => {
    const broken = { name: 'No id', isVerified: true, isActive: true };
    expect(SerializedWorkerSchema.safeParse(broken).success).toBe(false);
  });

  it('FAILS validation when a field has the wrong type', () => {
    const broken = { ...workerFixture, isVerified: 'yes' };
    expect(SerializedWorkerSchema.safeParse(broken).success).toBe(false);
  });

  it('FAILS validation when the envelope is missing the status code', () => {
    expect(ApiEnvelopeSchema.safeParse({ status: 'success', data: {} }).success).toBe(false);
  });
});
