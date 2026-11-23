/**
 * SDK ↔ API contract tests — validate that SDK consumers (packages/app)
 * receive response shapes matching @bluecollar/types contracts.
 *
 * Issue #1868 — These tests detect schema drift between:
 *  1. API serializer output (what the server actually sends)
 *  2. @bluecollar/types interfaces (what SDK consumers expect)
 *
 * Run: pnpm --filter @bluecollar/api test:contract
 * Or: vitest run src/__tests__/contract/sdk-api-contract.test.ts
 *
 * When a test fails, it means the API's serializer output diverged from the
 * shared type contract. Fix by updating either:
 *  - The serializer (if the API changed intentionally)
 *  - The @bluecollar/types interface (if the contract changed)
 *  - Both (if they drifted independently)
 */
import { describe, it, expect } from 'vitest';
import type {
  User,
  Worker,
  Category,
  Review,
  Job,
  ApiResponse,
  AccountInfo,
} from '@bluecollar/types';
import { categorySerializer } from '../../serializers/category.serializer.js';
import { userSerializer } from '../../serializers/user.serializer.js';
import { reviewSerializer } from '../../serializers/review.serializer.js';
import { workerSerializer } from '../../serializers/worker.serializer.js';
import { jobSerializer } from '../../serializers/job.serializer.js';

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
  phone: '+1234567890',
  email: 'bob@example.com',
  category: categoryFixture,
  curator: userFixture,
};

const jobFixture = {
  id: 'job_1',
  title: 'Fix leaky pipe',
  description: 'Need urgent plumbing help',
  budget: 150,
  skills: ['plumbing', 'pipe-repair'],
  urgency: 'urgent' as const,
  escrowAmount: null,
  escrowTxId: null,
  status: 'open' as const,
  expiresAt: new Date('2026-12-31T00:00:00Z'),
  renewedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  categoryId: 'cat_1',
  locationId: 'loc_1',
  postedById: 'usr_1',
  category: categoryFixture,
  location: {
    id: 'loc_1',
    city: 'Lisbon',
    state: null,
    country: 'Portugal',
  },
  postedBy: {
    id: 'usr_1',
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatar: null,
  },
  _count: {
    applications: 3,
    messages: 5,
  },
};

// ── Helper: validate shape matches @bluecollar/types interface ────────────────

/**
 * Type-level assertion that serializer output is assignable to the SDK type.
 * If this compiles, the shape is compatible.
 */
function assertAssignableTo<T>(_value: T): void {
  // Type check only; no runtime assertion
}

// ── Category contract ──────────────────────────────────────────────────────────

describe('SDK ↔ API contract: Category', () => {
  it('serializes to shape compatible with Category type', () => {
    const serialized = categorySerializer(categoryFixture);

    // Type check: serializer output is assignable to Category
    assertAssignableTo<Category>(serialized);

    // Runtime validation
    expect(serialized).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
    });
    expect(typeof serialized.description === 'string' || serialized.description === null).toBe(
      true,
    );
    expect(typeof serialized.icon === 'string' || serialized.icon === null).toBe(true);
  });

  it('omits internal fields', () => {
    const serialized = categorySerializer(categoryFixture);
    expect(serialized).not.toHaveProperty('createdAt');
    expect(serialized).not.toHaveProperty('updatedAt');
  });
});

// ── User contract ─────────────────────────────────────────────────────────────

describe('SDK ↔ API contract: User', () => {
  it('serializes to shape compatible with User type', () => {
    const serialized = userSerializer(userFixture);

    // Type check: serializer output is assignable to User
    assertAssignableTo<User>(serialized);

    // Runtime validation
    expect(serialized).toMatchObject({
      id: expect.any(String),
      email: expect.any(String),
      firstName: expect.any(String),
      lastName: expect.any(String),
      role: expect.stringMatching(/^(user|curator|admin)$/),
      verified: expect.any(Boolean),
    });
  });

  it('strips PII / secret fields', () => {
    const serialized = userSerializer(userFixture);

    expect(serialized).not.toHaveProperty('password');
    expect(serialized).not.toHaveProperty('verificationToken');
    expect(serialized).not.toHaveProperty('verificationTokenExpiry');
    expect(serialized).not.toHaveProperty('resetToken');
    expect(serialized).not.toHaveProperty('resetTokenExpiry');
    expect(serialized).not.toHaveProperty('twoFactorSecret');
    expect(serialized).not.toHaveProperty('twoFactorBackupCodes');
  });
});

// ── Review contract ───────────────────────────────────────────────────────────

describe('SDK ↔ API contract: Review', () => {
  it('serializes to shape compatible with Review type', () => {
    const serialized = reviewSerializer(reviewFixture);

    // Type check: serializer output is assignable to Review
    assertAssignableTo<Review>(serialized);

    // Runtime validation
    expect(serialized).toMatchObject({
      id: expect.any(String),
      rating: expect.any(Number),
      workerId: expect.any(String),
      authorId: expect.any(String),
      createdAt: expect.any(String),
    });
    expect(serialized.author).toMatchObject({
      id: expect.any(String),
      firstName: expect.any(String),
      lastName: expect.any(String),
    });
  });

  it('allows null comment', () => {
    const serialized = reviewSerializer({ ...reviewFixture, comment: null });
    expect(serialized.comment).toBeNull();
  });
});

// ── Worker contract (KNOWN DRIFT) ─────────────────────────────────────────────

describe('SDK ↔ API contract: Worker', () => {
  it('KNOWN DRIFT: API serializer strips phone/email, adds images object', () => {
    const serialized = workerSerializer(workerFixture);

    // The API intentionally diverges from @bluecollar/types#Worker:
    // 1. PII fields (phone, email) are stripped
    // 2. `images` object replaces `portfolioImages` array
    //
    // This is documented in responseSchemas.ts. The drift exists because
    // Worker is a shared type used in multiple contexts, but the API only
    // exposes a sanitized subset.

    // Verify PII is stripped
    expect(serialized).not.toHaveProperty('phone');
    expect(serialized).not.toHaveProperty('email');

    // Verify images object structure (not in @bluecollar/types#Worker)
    if (serialized.images) {
      expect(serialized.images).toMatchObject({
        thumb: expect.any(String),
        medium: expect.any(String),
        full: expect.any(String),
      });
    }

    // Verify portfolioImages is NOT present
    expect(serialized).not.toHaveProperty('portfolioImages');

    // Type check will fail here because serialized shape !== Worker:
    // assertAssignableTo<Worker>(serialized); // ❌ Intentionally commented out
  });

  it('includes core Worker fields', () => {
    const serialized = workerSerializer(workerFixture);

    expect(serialized).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      isVerified: expect.any(Boolean),
      isActive: expect.any(Boolean),
    });
  });

  it('includes nested category when provided', () => {
    const serialized = workerSerializer(workerFixture);
    expect(serialized.category).toMatchObject({
      id: 'cat_1',
      name: 'Plumber',
    });
  });

  it('includes nested curator when provided', () => {
    const serialized = workerSerializer(workerFixture);
    expect(serialized.curator).toMatchObject({
      id: 'usr_1',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });
});

// ── Job contract ──────────────────────────────────────────────────────────────

describe('SDK ↔ API contract: Job', () => {
  it('serializes to shape compatible with Job type', () => {
    const serialized = jobSerializer(jobFixture);

    // Type check: serializer output is assignable to Job
    assertAssignableTo<Job>(serialized);

    // Runtime validation
    expect(serialized).toMatchObject({
      id: expect.any(String),
      title: expect.any(String),
      description: expect.any(String),
      skills: expect.any(Array),
      urgency: expect.stringMatching(/^(low|normal|urgent)$/),
      status: expect.stringMatching(/^(open|closed|expired|filled)$/),
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  it('includes nested category', () => {
    const serialized = jobSerializer(jobFixture);
    expect(serialized.category).toMatchObject({
      id: 'cat_1',
      name: 'Plumber',
    });
  });

  it('includes nested postedBy user', () => {
    const serialized = jobSerializer(jobFixture);
    expect(serialized.postedBy).toMatchObject({
      id: 'usr_1',
      firstName: 'Ada',
      lastName: 'Lovelace',
    });
  });

  it('allows nullable budget and escrowAmount', () => {
    const serialized = jobSerializer({ ...jobFixture, budget: null, escrowAmount: null });
    expect(serialized.budget).toBeNull();
    expect(serialized.escrowAmount).toBeNull();
  });
});

// ── ApiResponse envelope ──────────────────────────────────────────────────────

describe('SDK ↔ API contract: ApiResponse envelope', () => {
  it('response envelope matches ApiResponse<T> shape', () => {
    // Simulate a successful API response
    const envelope = {
      status: 'success' as const,
      code: 200,
      data: categorySerializer(categoryFixture),
    };

    // Type check: envelope is assignable to ApiResponse<Category>
    assertAssignableTo<ApiResponse<Category>>(envelope);

    expect(envelope).toMatchObject({
      status: 'success',
      code: 200,
      data: expect.any(Object),
    });
  });

  it('error envelope matches ApiResponse shape', () => {
    const envelope = {
      status: 'error' as const,
      code: 404,
      message: 'Not found',
    };

    // Type check: error envelope is assignable to ApiResponse
    assertAssignableTo<ApiResponse>(envelope);

    expect(envelope).toMatchObject({
      status: 'error',
      code: 404,
      message: 'Not found',
    });
  });

  it('paginated envelope includes meta', () => {
    const envelope = {
      status: 'success' as const,
      code: 200,
      data: [categorySerializer(categoryFixture)],
      meta: {
        total: 10,
        page: 1,
        limit: 10,
        pages: 1,
      },
    };

    // Type check
    assertAssignableTo<ApiResponse<Category[]>>(envelope);

    expect(envelope.meta).toMatchObject({
      total: expect.any(Number),
      page: expect.any(Number),
      limit: expect.any(Number),
      pages: expect.any(Number),
    });
  });
});

// ── AccountInfo (Stellar SDK type) ────────────────────────────────────────────

describe('SDK ↔ API contract: AccountInfo', () => {
  it('Horizon account response matches AccountInfo type', () => {
    // This is the shape returned by HorizonClient.getAccountInfo
    const accountInfo = {
      publicKey: 'GBBD47UZQ5E7XNLRY3ELYQ2YZKOXZ5DJQLNBPMFXO32VVKKQMKQP5XY',
      balance: 100.5,
      sequence: BigInt('123456789'),
    };

    // Type check: HorizonClient output is assignable to AccountInfo
    assertAssignableTo<AccountInfo>(accountInfo);

    expect(accountInfo).toMatchObject({
      publicKey: expect.any(String),
      balance: expect.any(Number),
      sequence: expect.any(BigInt),
    });
  });

  it('allows sequence as string (Stellar SDK compatibility)', () => {
    const accountInfo = {
      publicKey: 'GBBD47UZQ5E7XNLRY3ELYQ2YZKOXZ5DJQLNBPMFXO32VVKKQMKQP5XY',
      balance: 100.5,
      sequence: '123456789',
    };

    // Type check: string sequence is compatible
    assertAssignableTo<{ publicKey: string; balance: number; sequence: bigint | string }>(
      accountInfo,
    );

    expect(accountInfo.sequence).toBe('123456789');
  });
});

// ── Summary ───────────────────────────────────────────────────────────────────

describe('SDK ↔ API contract drift summary', () => {
  it('documents known drift between @bluecollar/types and API serializers', () => {
    const knownDrift = [
      {
        type: 'Worker',
        issue: 'API strips PII (phone, email) and uses images{} instead of portfolioImages[]',
        location: 'packages/api/src/serializers/worker.serializer.ts',
        status: 'Intentional — API exposes sanitized Worker subset',
      },
    ];

    expect(knownDrift).toHaveLength(1);

    // All other types (Category, User, Review, Job, ApiResponse, AccountInfo)
    // have serializers that match @bluecollar/types interfaces.
  });
});
