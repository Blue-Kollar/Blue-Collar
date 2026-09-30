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
import { jobSerializer } from '../../serializers/job.serializer.js';
import {
  ApiEnvelopeSchema,
  CategorySchema,
  SerializedUserSchema,
  SerializedReviewSchema,
  SerializedWorkerSchema,
  SerializedJobSchema,
  SerializedBookingSchema,
  SerializedNotificationSchema,
  AuthLoginResponseSchema,
  HealthResponseSchema,
  ReadinessResponseSchema,
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

// ── Job fixture ───────────────────────────────────────────────────────────────

const jobFixture = {
  id: 'job_1',
  title: 'Fix leaking pipe',
  description: 'The kitchen sink pipe is leaking and needs urgent repair.',
  budget: 250,
  skills: ['plumbing', 'pipe-repair'],
  urgency: 'urgent' as const,
  escrowAmount: null,
  escrowTxId: null,
  status: 'open' as const,
  expiresAt: new Date('2026-10-01T00:00:00Z'),
  renewedAt: null,
  createdAt: new Date('2026-01-15T00:00:00Z'),
  updatedAt: new Date('2026-01-15T00:00:00Z'),
  categoryId: 'cat_1',
  postedById: 'usr_1',
  locationId: null,
  category: categoryFixture,
  postedBy: { ...userFixture, password: undefined } as never,
};

// ── Job ───────────────────────────────────────────────────────────────────────

describe('API contract — Job (GET /jobs, GET /jobs/:id)', () => {
  it('serialized job matches the contract schema', () => {
    const result = jobSerializer.serialize(jobFixture as never);
    expect(SerializedJobSchema.safeParse(result).success).toBe(true);
  });

  it('job without optional fields still validates', () => {
    const minimal = {
      ...jobFixture,
      category: undefined,
      postedBy: undefined,
      budget: null,
      escrowAmount: null,
    };
    const result = jobSerializer.serialize(minimal as never);
    expect(SerializedJobSchema.safeParse(result).success).toBe(true);
  });

  it('paginated job list matches paginated schema', () => {
    const result = jobSerializer.serialize(jobFixture as never);
    const body = {
      data: [result],
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    };
    expect(PaginatedSchema(SerializedJobSchema).safeParse(body).success).toBe(true);
  });
});

// ── Booking ───────────────────────────────────────────────────────────────────

describe('API contract — Booking (POST /bookings, GET /bookings/mine)', () => {
  it('booking response object matches the contract schema', () => {
    const bookingResponse = {
      id: 'book_1',
      workerId: 'w_1',
      requesterId: 'usr_1',
      status: 'pending' as const,
      startTime: new Date('2026-09-01T09:00:00Z'),
      endTime: new Date('2026-09-01T11:00:00Z'),
      timezone: 'UTC',
      note: 'Please bring your own tools',
      serviceDescription: 'Replace kitchen faucet',
      cancelledAt: null,
      cancelReason: null,
      createdAt: new Date('2026-08-20T00:00:00Z'),
      updatedAt: new Date('2026-08-20T00:00:00Z'),
    };
    expect(SerializedBookingSchema.safeParse(bookingResponse).success).toBe(true);
  });

  it('FAILS when booking status is an unrecognised value', () => {
    const broken = {
      id: 'book_2',
      workerId: 'w_1',
      requesterId: 'usr_1',
      status: 'unknown_status',
      startTime: new Date(),
      endTime: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(SerializedBookingSchema.safeParse(broken).success).toBe(false);
  });
});

// ── Notification ──────────────────────────────────────────────────────────────

describe('API contract — Notification (GET /notifications)', () => {
  it('notification object matches the contract schema', () => {
    const notification = {
      id: 'notif_1',
      userId: 'usr_1',
      type: 'review' as const,
      title: 'New review on your listing',
      message: 'You received a 5-star review',
      href: '/workers/w_1#reviews',
      read: false,
      createdAt: '2026-01-20T10:00:00Z',
    };
    expect(SerializedNotificationSchema.safeParse(notification).success).toBe(true);
  });

  it('notification without optional fields still validates', () => {
    const minimal = {
      id: 'notif_2',
      userId: 'usr_1',
      type: 'system' as const,
      title: 'Platform maintenance scheduled',
      read: true,
      createdAt: '2026-02-01T00:00:00Z',
    };
    expect(SerializedNotificationSchema.safeParse(minimal).success).toBe(true);
  });
});

// ── Auth login response ───────────────────────────────────────────────────────

describe('API contract — Auth (POST /auth/login)', () => {
  it('login response envelope matches the contract schema', () => {
    const loginResponse = {
      status: 'success' as const,
      code: 202,
      message: 'Login successful',
      token: 'eyJhbGciOiJIUzI1NiJ9.payload.signature',
      data: {
        id: 'usr_1',
        email: 'worker@example.com',
        firstName: 'Ada',
        lastName: 'Lovelace',
        role: 'user' as const,
        verified: true,
        avatar: null,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-02T00:00:00Z'),
      },
    };
    expect(AuthLoginResponseSchema.safeParse(loginResponse).success).toBe(true);
  });

  it('FAILS when login response is missing the token', () => {
    const broken = {
      status: 'success',
      code: 202,
      data: { id: 'usr_1', email: 'a@b.com', firstName: 'A', lastName: 'B', role: 'user', verified: true },
    };
    expect(AuthLoginResponseSchema.safeParse(broken).success).toBe(false);
  });
});

// ── Health / Readiness ────────────────────────────────────────────────────────

describe('API contract — Health (GET /health)', () => {
  it('health liveness response matches the contract schema', () => {
    expect(HealthResponseSchema.safeParse({ status: 'ok' }).success).toBe(true);
  });

  it('FAILS when health response has an unexpected status value', () => {
    expect(HealthResponseSchema.safeParse({ status: 'degraded' }).success).toBe(false);
  });
});

describe('API contract — Readiness (GET /ready)', () => {
  it('readiness response with all checks ok matches the contract schema', () => {
    const ready = {
      status: 'ok' as const,
      service: 'bluecollar-api',
      timestamp: '2026-09-30T08:00:00.000Z',
      checks: {
        database: { status: 'ok' as const },
        redis: { status: 'ok' as const },
        queue: { status: 'ok' as const },
        horizon: { status: 'ok' as const },
      },
    };
    expect(ReadinessResponseSchema.safeParse(ready).success).toBe(true);
  });

  it('readiness response with a degraded database still matches the schema', () => {
    const degraded = {
      status: 'degraded' as const,
      service: 'bluecollar-api',
      timestamp: '2026-09-30T08:00:00.000Z',
      checks: {
        database: { status: 'error' as const, error: 'Connection refused' },
        redis: { status: 'ok' as const },
        queue: { status: 'ok' as const },
        horizon: { status: 'ok' as const },
      },
    };
    expect(ReadinessResponseSchema.safeParse(degraded).success).toBe(true);
  });

  it('FAILS when readiness response is missing a required check', () => {
    const broken = {
      status: 'ok',
      service: 'bluecollar-api',
      timestamp: '2026-09-30T08:00:00.000Z',
      checks: {
        database: { status: 'ok' },
        redis: { status: 'ok' },
        // queue and horizon missing
      },
    };
    expect(ReadinessResponseSchema.safeParse(broken).success).toBe(false);
  });
});
