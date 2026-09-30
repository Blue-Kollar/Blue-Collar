/**
 * Runtime response-shape schemas for Blue-Collar API contract tests.
 *
 * These zod schemas are the executable form of the API response contract.
 * They are derived from the canonical shared types in `@bluecollar/types`
 * wherever the API response matches those types (Category, User, Review,
 * AccountInfo, the envelope). For entities where the live API response diverges
 * from `@bluecollar/types` (notably `Worker`, which intentionally strips PII
 * `phone`/`email` and emits an `images` object rather than `portfolioImages`),
 * the schema mirrors the *actual* serializer output — that is what clients
 * receive, so it is the real contract. The divergence is tracked as a TODO to
 * reconcile `@bluecollar/types` with the API.
 *
 * The contract tests validate the real serializers (the exact objects the
 * controllers return) against these schemas, giving runtime detection of
 * response-shape drift — not just compile-time safety.
 */
import { z } from 'zod';

const dateOrString = z.union([z.string(), z.date()]);

/** Standard envelope returned by every endpoint. */
export const ApiEnvelopeSchema = z.object({
  status: z.union([z.literal('success'), z.literal('error'), z.string()]),
  code: z.number(),
  data: z.unknown().optional(),
  message: z.string().optional(),
  meta: z
    .object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    })
    .optional(),
  token: z.string().optional(),
});

export const CategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  createdAt: dateOrString.optional(),
  updatedAt: dateOrString.optional(),
});

export const SerializedUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(['user', 'curator', 'admin']),
  verified: z.boolean(),
  avatar: z.string().nullable().optional(),
  onboardingCompleted: z.boolean().optional(),
  createdAt: dateOrString.optional(),
  updatedAt: dateOrString.optional(),
});

export const SerializedReviewSchema = z.object({
  id: z.string(),
  rating: z.number(),
  comment: z.string().nullable().optional(),
  workerId: z.string(),
  authorId: z.string(),
  createdAt: z.string(),
  author: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      avatar: z.string().nullable().optional(),
    })
    .optional(),
});

/**
 * Mirrors packages/api/src/serializers/worker.serializer.ts output.
 * NOTE: diverges from `@bluecollar/types#Worker` — PII (`phone`,`email`) is
 * intentionally omitted and `images` replaces `portfolioImages`.
 */
export const SerializedWorkerSchema = z.object({
  id: z.string(),
  name: z.string(),
  bio: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  isVerified: z.boolean(),
  isActive: z.boolean(),
  locationId: z.string().nullable().optional(),
  walletAddress: z.string().nullable().optional(),
  categoryId: z.string().optional(),
  images: z
    .object({
      thumb: z.string().nullable(),
      medium: z.string().nullable(),
      full: z.string().nullable(),
    })
    .optional(),
  category: CategorySchema.optional(),
  curator: SerializedUserSchema.optional(),
  averageRating: z.number().nullable().optional(),
  reviewCount: z.number().optional(),
  createdAt: dateOrString.optional(),
  updatedAt: dateOrString.optional(),
});

export const PaginatedSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    data: z.array(item),
    meta: z.object({
      total: z.number(),
      page: z.number(),
      limit: z.number(),
      pages: z.number(),
    }),
  });

export const AccountInfoSchema = z.object({
  publicKey: z.string(),
  balance: z.number(),
  sequence: z.union([z.bigint(), z.string(), z.number()]),
});

// ─── Job ──────────────────────────────────────────────────────────────────────

/**
 * Mirrors packages/types#Job (serialized for API responses).
 * Used by GET /jobs, GET /jobs/:id, POST /jobs.
 */
export const SerializedJobSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  budget: z.number().nullable().optional(),
  skills: z.array(z.string()),
  urgency: z.enum(['low', 'normal', 'urgent']),
  escrowAmount: z.number().nullable().optional(),
  escrowTxId: z.string().nullable().optional(),
  status: z.enum(['open', 'closed', 'expired', 'filled']),
  expiresAt: dateOrString.nullable().optional(),
  renewedAt: dateOrString.nullable().optional(),
  createdAt: dateOrString,
  updatedAt: dateOrString,
  categoryId: z.string().optional(),
  category: CategorySchema.optional(),
  postedBy: z
    .object({
      id: z.string(),
      firstName: z.string(),
      lastName: z.string(),
      avatar: z.string().nullable().optional(),
    })
    .optional(),
  _count: z
    .object({
      applications: z.number(),
      messages: z.number(),
    })
    .optional(),
});

// ─── Booking ──────────────────────────────────────────────────────────────────

/**
 * Mirrors the Booking Prisma model as returned by the bookings controller.
 * Used by POST /bookings, GET /bookings/mine, GET /bookings/:id.
 */
export const SerializedBookingSchema = z.object({
  id: z.string(),
  workerId: z.string(),
  requesterId: z.string(),
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed']),
  startTime: dateOrString,
  endTime: dateOrString,
  timezone: z.string().optional(),
  note: z.string().nullable().optional(),
  serviceDescription: z.string().nullable().optional(),
  cancelledAt: dateOrString.nullable().optional(),
  cancelReason: z.string().nullable().optional(),
  createdAt: dateOrString,
  updatedAt: dateOrString,
});

// ─── Notification ─────────────────────────────────────────────────────────────

/**
 * Mirrors packages/types#AppNotification as returned by GET /notifications.
 */
export const SerializedNotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.enum(['tip', 'review', 'contact', 'system', 'message']),
  title: z.string(),
  message: z.string().nullable().optional(),
  href: z.string().nullable().optional(),
  read: z.boolean(),
  createdAt: z.string(),
});

// ─── Auth login response ──────────────────────────────────────────────────────

/**
 * Mirrors the POST /auth/login (202) response envelope.
 * Contains the user payload + JWT token.
 */
export const AuthLoginResponseSchema = z.object({
  status: z.literal('success'),
  code: z.number(),
  message: z.string().optional(),
  token: z.string(),
  data: SerializedUserSchema,
});

// ─── Health / Readiness ───────────────────────────────────────────────────────

/** GET /health liveness probe response. */
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
});

const CheckResultSchema = z.object({
  status: z.enum(['ok', 'error']),
  error: z.string().optional(),
});

/** GET /ready (alias /readyz) readiness probe response. */
export const ReadinessResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.string(),
  timestamp: z.string(),
  checks: z.object({
    database: CheckResultSchema,
    redis: CheckResultSchema,
    queue: CheckResultSchema,
    horizon: CheckResultSchema,
  }),
});
