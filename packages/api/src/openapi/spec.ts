import { OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import {
  registerRules, loginRules, forgotPasswordRules,
  resetPasswordRules, verifyAccountRules, resendVerificationRules,
} from '../validations/auth.js'
import { createWorkerRules, updateWorkerRules } from '../validations/worker.js'
import {
  registry, BearerAuth, ErrorSchema, SuccessSchema, CategorySchema,
  WorkerSchema, UserSchema, TokenResponseSchema, PaginatedWorkersSchema,
} from './registry.js'

export { registry }

// Domain path modules register themselves against the shared `registry` singleton
// as a side effect of being imported — see packages/api/src/openapi/paths/.
// Most use the /api/v1/* prefix, matching this spec's version. A few route files
// (analytics, wallet, escrow, indexer/events, messages, notification-preferences,
// portfolio, subscriptions, worker-events, vitals) are only mounted at the
// unversioned /api/* prefix in app.ts, so those paths.ts modules register the
// unversioned path instead — see app.ts's route-mounting section for the source
// of truth on which prefixes a given router actually answers on.
import './paths/webhooks.js'
import './paths/audit.js'
import './paths/recommendations.js'
import './paths/indexer.js'
import './paths/referral.js'
import './paths/response-time.js'
import './paths/messages.js'
import './paths/devices.js'
import './paths/wallet.js'
import './paths/insurance.js'
import './paths/subscriptions.js'
import './paths/portfolio.js'
import './paths/escrow.js'
import './paths/analytics.js'
import './paths/bookings.js'
import './paths/notification-preferences.js'
import './paths/notifications.js'
import './paths/verifications.js'
import './paths/vitals.js'
import './paths/worker-events.js'

// ── Auth ──────────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post', path: '/api/v1/auth/register', tags: ['Auth'],
  summary: 'Register a new account',
  request: { body: { content: { 'application/json': { schema: registerRules } } } },
  responses: {
    201: { description: 'Account created', content: { 'application/json': { schema: TokenResponseSchema } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
    409: { description: 'Email already in use', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/auth/login', tags: ['Auth'],
  summary: 'Login with email and password',
  request: { body: { content: { 'application/json': { schema: loginRules } } } },
  responses: {
    202: { description: 'Login successful', content: { 'application/json': { schema: TokenResponseSchema } } },
    401: { description: 'Invalid credentials', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/auth/logout', tags: ['Auth'],
  summary: 'Logout (revokes refresh tokens)',
  security: [{ [BearerAuth.name]: [] }],
  responses: {
    200: { description: 'Logged out', content: { 'application/json': { schema: SuccessSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/auth/me', tags: ['Auth'],
  summary: 'Get current user',
  security: [{ [BearerAuth.name]: [] }],
  responses: {
    200: { description: 'Current user', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: UserSchema }) } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/auth/refresh', tags: ['Auth'],
  summary: 'Refresh access token',
  responses: {
    200: { description: 'New token pair', content: { 'application/json': { schema: TokenResponseSchema } } },
    401: { description: 'Invalid refresh token', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'put', path: '/api/v1/auth/verify-account', tags: ['Auth'],
  summary: 'Verify email address',
  request: { body: { content: { 'application/json': { schema: verifyAccountRules } } } },
  responses: {
    200: { description: 'Account verified', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Invalid token', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/auth/resend-verification', tags: ['Auth'],
  summary: 'Resend verification email',
  request: { body: { content: { 'application/json': { schema: resendVerificationRules } } } },
  responses: { 200: { description: 'Email sent', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/auth/unsubscribe-reminders', tags: ['Auth'],
  summary: 'One-click unsubscribe from reminder emails (via emailed link token)',
  request: { query: z.object({ token: z.string() }) },
  responses: { 200: { description: 'Unsubscribed', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/auth/forgot-password', tags: ['Auth'],
  summary: 'Request password reset email',
  request: { body: { content: { 'application/json': { schema: forgotPasswordRules } } } },
  responses: { 200: { description: 'Reset email sent (always 200)', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'put', path: '/api/v1/auth/reset-password', tags: ['Auth'],
  summary: 'Reset password with token',
  request: { body: { content: { 'application/json': { schema: resetPasswordRules } } } },
  responses: {
    200: { description: 'Password updated', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Invalid or expired token', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/auth/google', tags: ['Auth'],
  summary: 'Initiate Google OAuth flow',
  responses: { 302: { description: 'Redirect to Google consent screen' } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/auth/google/callback', tags: ['Auth'],
  summary: 'Google OAuth callback',
  responses: { 302: { description: 'Redirect to frontend with JWT' } },
})

// ── Categories ────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/v1/categories', tags: ['Categories'],
  summary: 'List all categories',
  responses: {
    200: { description: 'Category list', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(CategorySchema) }) } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/categories/{id}', tags: ['Categories'],
  summary: 'Get a single category',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Category', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: CategorySchema }) } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/categories', tags: ['Categories'],
  summary: 'Create a category (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ name: z.string(), slug: z.string() }) } } } },
  responses: { 201: { description: 'Category created', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: CategorySchema }) } } } },
})

registry.registerPath({
  method: 'put', path: '/api/v1/categories/{id}', tags: ['Categories'],
  summary: 'Update a category (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ name: z.string().optional(), slug: z.string().optional() }) } } } },
  responses: { 200: { description: 'Category updated', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: CategorySchema }) } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/categories/{id}', tags: ['Categories'],
  summary: 'Delete a category (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } } },
})

// ── Workers ───────────────────────────────────────────────────────────────────
const workerQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  category: z.string().optional(),
  search: z.string().optional(),
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers', tags: ['Workers'],
  summary: 'List active workers (paginated)',
  request: { query: workerQuerySchema },
  responses: {
    200: { description: 'Worker list', content: { 'application/json': { schema: PaginatedWorkersSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/mine', tags: ['Workers'],
  summary: 'List my worker listings (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: {
    200: { description: 'My workers', content: { 'application/json': { schema: PaginatedWorkersSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}', tags: ['Workers'],
  summary: 'Get a single worker',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Worker', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: WorkerSchema }) } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/workers', tags: ['Workers'],
  summary: 'Create a worker listing (curator)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: createWorkerRules }, 'multipart/form-data': { schema: createWorkerRules } } } },
  responses: {
    201: { description: 'Worker created', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: WorkerSchema }) } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
    401: { description: 'Unauthorized', content: { 'application/json': { schema: ErrorSchema } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'put', path: '/api/v1/workers/{id}', tags: ['Workers'],
  summary: 'Update a worker (curator). Use POST + X-HTTP-Method: PUT for file uploads.',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: updateWorkerRules }, 'multipart/form-data': { schema: updateWorkerRules } } },
  },
  responses: {
    200: { description: 'Worker updated', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: WorkerSchema }) } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/workers/{id}', tags: ['Workers'],
  summary: 'Delete a worker (curator)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/workers/{id}/toggle', tags: ['Workers'],
  summary: 'Toggle worker active status (curator)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Status toggled', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: WorkerSchema }) } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/workers/{id}/reviews', tags: ['Workers'],
  summary: 'Submit a review for a worker',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ rating: z.number().int().min(1).max(5), comment: z.string().optional() }) } } },
  },
  responses: {
    201: { description: 'Review created', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/workers/{id}/bookmark', tags: ['Workers'],
  summary: 'Toggle bookmark on a worker',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Bookmark toggled', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/workers/{id}/contact', tags: ['Workers'],
  summary: 'Send a contact request to a worker',
  security: [{ [BearerAuth.name]: [] }],
  request: {
    params: z.object({ id: z.string() }),
    body: { content: { 'application/json': { schema: z.object({ message: z.string().min(10) }) } } },
  },
  responses: { 201: { description: 'Request sent', content: { 'application/json': { schema: SuccessSchema } } } },
})

// ── Users ─────────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'patch', path: '/api/v1/users/me', tags: ['Users'],
  summary: 'Update own profile',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ firstName: z.string().optional(), lastName: z.string().optional(), phone: z.string().optional(), bio: z.string().optional() }) } } } },
  responses: {
    200: { description: 'Profile updated', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: UserSchema }) } } },
  },
})

registry.registerPath({
  method: 'put', path: '/api/v1/users/me/password', tags: ['Users'],
  summary: 'Change password',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ currentPassword: z.string(), newPassword: z.string().min(8) }) } } } },
  responses: {
    200: { description: 'Password changed', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Wrong current password', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/users/me', tags: ['Users'],
  summary: 'Delete own account',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Account deleted', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/users/me/bookmarks', tags: ['Users'],
  summary: 'List bookmarked workers',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Bookmarks', content: { 'application/json': { schema: PaginatedWorkersSchema } } } },
})

// ── Payments ──────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/v1/payments/fee', tags: ['Payments'],
  summary: 'Get current platform fee',
  responses: { 200: { description: 'Fee info', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.object({ fee_bps: z.number() }) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/payments/fee', tags: ['Payments'],
  summary: 'Update platform fee (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ fee_bps: z.number().int().min(0) }) } } } },
  responses: { 200: { description: 'Fee updated', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/payments/tip', tags: ['Payments'],
  summary: 'Send a tip to a worker via Stellar',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ from: z.string(), to: z.string(), amount: z.number().positive() }) } } } },
  responses: {
    200: { description: 'Tip sent', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Invalid request', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/payments/escrow', tags: ['Payments'],
  summary: 'Create an escrow payment',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ from: z.string(), to: z.string(), amount: z.number().positive(), expiryDate: z.string() }) } } } },
  responses: {
    201: { description: 'Escrow created', content: { 'application/json': { schema: SuccessSchema } } },
  },
})

// ── Admin ─────────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/v1/admin/stats', tags: ['Admin'],
  summary: 'Platform statistics (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Stats', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/admin/workers', tags: ['Admin'],
  summary: 'List all workers (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Workers', content: { 'application/json': { schema: PaginatedWorkersSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/admin/users', tags: ['Admin'],
  summary: 'List all users (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Users', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(UserSchema) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/admin/workers/bulk-toggle', tags: ['Admin'],
  summary: 'Bulk toggle worker active status (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.string()).min(1) }) } } } },
  responses: { 200: { description: 'Toggled', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/admin/workers/bulk-delete', tags: ['Admin'],
  summary: 'Bulk delete workers (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.string()).min(1) }) } } } },
  responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/admin/audit', tags: ['Admin'],
  summary: 'List audit log entries (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Audit log entries', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/admin/users/{id}/suspend', tags: ['Admin'],
  summary: 'Suspend a user (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'User suspended', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/admin/users/{id}/unsuspend', tags: ['Admin'],
  summary: 'Unsuspend a user (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'User unsuspended', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/admin/users/{id}/ban', tags: ['Admin'],
  summary: 'Ban a user (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'User banned', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/admin/users/{id}/role', tags: ['Admin'],
  summary: "Change a user's role (admin)",
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ role: z.enum(['user', 'curator', 'admin']) }) } } } },
  responses: { 200: { description: 'Role changed', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/admin/users/bulk-suspend', tags: ['Admin'],
  summary: 'Bulk suspend users (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.string()).min(1) }) } } } },
  responses: { 200: { description: 'Suspended', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/admin/users/bulk-unsuspend', tags: ['Admin'],
  summary: 'Bulk unsuspend users (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ ids: z.array(z.string()).min(1) }) } } } },
  responses: { 200: { description: 'Unsuspended', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/admin/workers/{id}/moderate', tags: ['Admin'],
  summary: 'Moderate a worker listing (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ action: z.enum(['approve', 'reject']) }) } } } },
  responses: { 200: { description: 'Worker moderated', content: { 'application/json': { schema: SuccessSchema } } } },
})

// ── Health ────────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/health', tags: ['Health'],
  summary: 'Liveness check',
  responses: { 200: { description: 'OK', content: { 'application/json': { schema: z.object({ status: z.literal('ok') }) } } } },
})

registry.registerPath({
  method: 'get', path: '/ready', tags: ['Health'],
  summary: 'Readiness check (DB + Redis)',
  responses: {
    200: { description: 'Ready', content: { 'application/json': { schema: z.object({ status: z.string(), checks: z.record(z.unknown()) }) } } },
    503: { description: 'Degraded', content: { 'application/json': { schema: z.object({ status: z.string(), checks: z.record(z.unknown()) }) } } },
  },
})

// ── Versioning ────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/version', tags: ['Versioning'],
  summary: 'Get API versioning information',
  responses: {
    200: {
      description: 'API versioning info',
      content: {
        'application/json': {
          schema: z.object({
            apiPackageVersion: z.string(),
            apiVersions: z.array(z.string()),
            currentVersion: z.string(),
            deprecatedVersions: z.array(z.string()),
            status: z.string(),
          }),
        },
      },
    },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/version', tags: ['Versioning'],
  summary: 'Get v1 API version information',
  responses: {
    200: {
      description: 'v1 API version info',
      content: {
        'application/json': {
          schema: z.object({
            version: z.string(),
            apiVersion: z.string(),
            status: z.string(),
            supported: z.array(z.string()),
            deprecated: z.array(z.string()),
            sunset: z.null(),
          }),
        },
      },
    },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/versions', tags: ['Versioning'],
  summary: 'List all supported API versions with metadata',
  responses: {
    200: {
      description: 'List of API versions',
      content: {
        'application/json': {
          schema: z.object({
            versions: z.array(z.object({
              version: z.string(),
              status: z.enum(['current', 'deprecated']),
              sunset: z.string().nullable(),
              rateLimiting: z.object({
                requests: z.number(),
                windowMs: z.number(),
              }),
            })),
            current: z.string(),
          }),
        },
      },
    },
  },
})

// ── 2FA ───────────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post', path: '/api/v1/auth/2fa/setup', tags: ['2FA'],
  summary: 'Generate TOTP secret and QR code',
  security: [{ [BearerAuth.name]: [] }],
  responses: {
    200: { description: 'QR code URI and backup codes', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.object({ otpauth: z.string(), qrCode: z.string(), backupCodes: z.array(z.string()) }) }) } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/auth/2fa/enable', tags: ['2FA'],
  summary: 'Enable 2FA after verifying TOTP code',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ code: z.string().length(6) }) } } } },
  responses: {
    200: { description: '2FA enabled', content: { 'application/json': { schema: SuccessSchema } } },
    400: { description: 'Invalid TOTP code', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/auth/2fa/verify', tags: ['2FA'],
  summary: 'Verify TOTP code during login (step 2)',
  request: { body: { content: { 'application/json': { schema: z.object({ userId: z.string(), code: z.string().length(6) }) } } } },
  responses: {
    200: { description: 'Verified — returns JWT', content: { 'application/json': { schema: TokenResponseSchema } } },
    401: { description: 'Invalid code', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/auth/2fa/verify-backup', tags: ['2FA'],
  summary: 'Verify a backup code (consumes it)',
  request: { body: { content: { 'application/json': { schema: z.object({ userId: z.string(), code: z.string() }) } } } },
  responses: {
    200: { description: 'Verified', content: { 'application/json': { schema: TokenResponseSchema } } },
    401: { description: 'Invalid code', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/auth/2fa', tags: ['2FA'],
  summary: 'Disable 2FA',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ code: z.string() }) } } } },
  responses: { 200: { description: '2FA disabled', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/auth/2fa/backup-codes/regenerate', tags: ['2FA'],
  summary: 'Regenerate backup codes',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'New backup codes', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.object({ backupCodes: z.array(z.string()) }) }) } } },
  },
})

// ── Jobs ──────────────────────────────────────────────────────────────────────
const JobSchema = registry.register('Job', z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  budget: z.number().nullable(),
  status: z.enum(['open', 'in_progress', 'completed', 'cancelled']),
  categoryId: z.string(),
  userId: z.string(),
  expiresAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
}))

const jobQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
})

registry.registerPath({
  method: 'get', path: '/api/v1/jobs', tags: ['Jobs'],
  summary: 'List jobs (paginated)',
  request: { query: jobQuerySchema },
  responses: { 200: { description: 'Job list', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(JobSchema), meta: z.object({ total: z.number(), page: z.number(), limit: z.number() }) }) } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/jobs/{id}', tags: ['Jobs'],
  summary: 'Get a single job',
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Job', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: JobSchema }) } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/jobs', tags: ['Jobs'],
  summary: 'Create a job posting',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ title: z.string(), description: z.string(), budget: z.number().optional(), categoryId: z.string(), expiresAt: z.string().optional() }) } } } },
  responses: {
    201: { description: 'Job created', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: JobSchema }) } } },
    400: { description: 'Validation error', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'put', path: '/api/v1/jobs/{id}', tags: ['Jobs'],
  summary: 'Update a job posting',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ title: z.string().optional(), description: z.string().optional(), budget: z.number().optional(), status: z.string().optional() }) } } } },
  responses: {
    200: { description: 'Job updated', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: JobSchema }) } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/jobs/{id}', tags: ['Jobs'],
  summary: 'Delete a job posting',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Deleted', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/jobs/{id}/renew', tags: ['Jobs'],
  summary: 'Renew a job posting (extend expiry)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Job renewed', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: JobSchema }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/jobs/me/posted', tags: ['Jobs'],
  summary: 'List jobs posted by the current user',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'My jobs', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(JobSchema) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/jobs/me/applications', tags: ['Jobs'],
  summary: 'List job applications made by the current user',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'My applications', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/jobs/{id}/apply', tags: ['Jobs'],
  summary: 'Apply to a job',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ coverLetter: z.string().optional(), proposedBudget: z.number().optional() }) } } } },
  responses: {
    201: { description: 'Application submitted', content: { 'application/json': { schema: SuccessSchema } } },
    409: { description: 'Already applied', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/jobs/{id}/applications', tags: ['Jobs'],
  summary: 'List applications for a job (job owner)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Applications', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/jobs/{id}/applications/{applicationId}', tags: ['Jobs'],
  summary: 'Update application status (accept / reject)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string(), applicationId: z.string() }), body: { content: { 'application/json': { schema: z.object({ status: z.enum(['accepted', 'rejected']) }) } } } },
  responses: { 200: { description: 'Status updated', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/jobs/{id}/apply', tags: ['Jobs'],
  summary: 'Withdraw a job application',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Withdrawn', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/jobs/{id}/messages', tags: ['Jobs'],
  summary: 'Send a message in a job thread',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ body: z.string().min(1) }) } } } },
  responses: { 201: { description: 'Message sent', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/jobs/{id}/messages', tags: ['Jobs'],
  summary: 'List messages in a job thread',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Messages', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/jobs/recommendations/{workerId}', tags: ['Jobs'],
  summary: 'Get recommended jobs for a worker',
  request: { params: z.object({ workerId: z.string() }) },
  responses: { 200: { description: 'Recommended jobs', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(JobSchema) }) } } } },
})

// ── Reviews (standalone) ──────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/reviews', tags: ['Reviews'],
  summary: 'List reviews for a worker',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Reviews with aggregate rating', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())), avgRating: z.number(), reviewCount: z.number() }) } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/workers/reviews/{id}', tags: ['Reviews'],
  summary: 'Delete a review (owner only)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: 'Deleted' },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// Mounted at /api/reviews/helpful (unversioned only — see app.ts) despite the
// module name; not to be confused with helpful.ts's /:reviewId/helpful below.
registry.registerPath({
  method: 'get', path: '/api/reviews/helpful', tags: ['Reviews'],
  summary: 'List reviews',
  responses: { 200: { description: 'Reviews', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/reviews/helpful', tags: ['Reviews'],
  summary: 'Create a review',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ workerId: z.string(), rating: z.number().min(1).max(5), comment: z.string().optional() }) } } } },
  responses: { 201: { description: 'Review created (pending moderation)', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/reviews/helpful/{id}', tags: ['Reviews'],
  summary: 'Delete a review (owner only)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    204: { description: 'Deleted' },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'patch', path: '/api/reviews/helpful/{id}/flag', tags: ['Reviews'],
  summary: 'Flag a review for moderation',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Flagged', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/reviews/helpful/moderation/queue', tags: ['Reviews'],
  summary: 'Get moderation queue (admin)',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Review queue', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/reviews/helpful/{id}/moderate', tags: ['Reviews'],
  summary: 'Approve or reject a flagged review (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ action: z.enum(['approve', 'reject']) }) } } } },
  responses: { 200: { description: 'Review moderated', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/reviews/{reviewId}/helpful', tags: ['Reviews'],
  summary: 'Toggle "helpful" vote on a review',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ reviewId: z.string() }) },
  responses: { 200: { description: 'Vote toggled', content: { 'application/json': { schema: SuccessSchema } } } },
})

// ── Disputes ──────────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'post', path: '/api/v1/disputes', tags: ['Disputes'],
  summary: 'Open a dispute',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ workerId: z.string(), reason: z.string().min(10), evidence: z.string().optional() }) } } } },
  responses: {
    201: { description: 'Dispute opened', content: { 'application/json': { schema: SuccessSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/disputes', tags: ['Disputes'],
  summary: 'List disputes for the authenticated user (or all, for admins)',
  security: [{ [BearerAuth.name]: [] }],
  request: { query: z.object({ page: z.string().optional(), limit: z.string().optional() }) },
  responses: { 200: { description: 'Disputes', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/disputes/{id}', tags: ['Disputes'],
  summary: 'Get a single dispute',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Dispute', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } },
    403: { description: 'Forbidden', content: { 'application/json': { schema: ErrorSchema } } },
    404: { description: 'Not found', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/disputes/{id}/resolve', tags: ['Disputes'],
  summary: 'Resolve a dispute (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ status: z.string(), resolution: z.string() }) } } } },
  responses: { 200: { description: 'Resolved', content: { 'application/json': { schema: SuccessSchema } } } },
})

// ── Worker extended endpoints ─────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/v1/workers/search', tags: ['Workers'],
  summary: 'Search workers',
  request: { query: z.object({ q: z.string().optional(), category: z.string().optional(), page: z.string().optional(), limit: z.string().optional() }) },
  responses: { 200: { description: 'Search results', content: { 'application/json': { schema: PaginatedWorkersSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/search/advanced', tags: ['Workers'],
  summary: 'Advanced worker search',
  request: { query: z.object({ q: z.string().optional(), category: z.string().optional(), location: z.string().optional(), minRating: z.string().optional(), available: z.string().optional(), page: z.string().optional(), limit: z.string().optional() }) },
  responses: { 200: { description: 'Search results', content: { 'application/json': { schema: PaginatedWorkersSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/availability', tags: ['Workers'],
  summary: 'Get worker availability',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Availability', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'put', path: '/api/v1/workers/{id}/availability', tags: ['Workers'],
  summary: 'Replace worker availability (curator)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.object({ slots: z.array(z.record(z.unknown())) }) } } } },
  responses: { 200: { description: 'Availability updated', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/workers/{id}/availability', tags: ['Workers'],
  summary: 'Add a single availability slot (curator)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), body: { content: { 'application/json': { schema: z.record(z.unknown()) } } } },
  responses: { 201: { description: 'Slot added', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/workers/{id}/availability/{slotId}', tags: ['Workers'],
  summary: 'Delete an availability slot (curator)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string(), slotId: z.string() }) },
  responses: { 200: { description: 'Slot deleted', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/analytics/dashboard', tags: ['Workers'],
  summary: "Get a worker's personal analytics dashboard (curator/admin)",
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Dashboard data', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/analytics/export', tags: ['Workers'],
  summary: "Export a worker's personal analytics as CSV (curator/admin)",
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'CSV export (text/csv)' } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/analytics/trends', tags: ['Workers'],
  summary: "Get a worker's profile-view trends (curator/admin)",
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }), query: z.object({ days: z.string().optional() }) },
  responses: { 200: { description: 'View trends', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/workers/{id}/register-on-chain', tags: ['Workers'],
  summary: 'Register worker on Stellar Registry contract (curator)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: {
    200: { description: 'Registered on-chain', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.object({ txHash: z.string() }) }) } } },
    400: { description: 'Already registered or invalid wallet', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/contacts', tags: ['Workers'],
  summary: 'List contact requests for a worker (curator)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Contact requests', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'patch', path: '/api/v1/workers/{id}/contacts/{requestId}', tags: ['Workers'],
  summary: 'Update contact request status (curator)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string(), requestId: z.string() }), body: { content: { 'application/json': { schema: z.object({ status: z.enum(['read', 'archived']) }) } } } },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/verifications', tags: ['Workers'],
  summary: 'List verifications for a worker (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Verifications', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.array(z.record(z.unknown())) }) } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/analytics', tags: ['Workers'],
  summary: 'Worker analytics (curator/admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Analytics', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.record(z.unknown()) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/workers/{id}/analytics/view', tags: ['Workers'],
  summary: 'Track a profile view (public)',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Tracked', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'get', path: '/api/v1/workers/{id}/reputation', tags: ['Workers'],
  summary: 'Get worker reputation score',
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Reputation', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.object({ score: z.number(), breakdown: z.record(z.unknown()) }) }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/workers/{id}/reputation/sync', tags: ['Workers'],
  summary: 'Sync reputation from on-chain data (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { params: z.object({ id: z.string() }) },
  responses: { 200: { description: 'Synced', content: { 'application/json': { schema: SuccessSchema } } } },
})

// ── Users extended ────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'put', path: '/api/v1/users/me', tags: ['Users'],
  summary: 'Full profile update (supports avatar upload via X-HTTP-Method: PUT)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'multipart/form-data': { schema: z.object({ firstName: z.string().optional(), lastName: z.string().optional(), bio: z.string().optional(), phone: z.string().optional(), avatar: z.string().optional() }) } } } },
  responses: { 200: { description: 'Updated', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: UserSchema }) } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/users/me/push-subscription', tags: ['Users'],
  summary: 'Save Web Push subscription',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'application/json': { schema: z.object({ endpoint: z.string(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }) } } } },
  responses: { 200: { description: 'Saved', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'delete', path: '/api/v1/users/me/push-subscription', tags: ['Users'],
  summary: 'Remove Web Push subscription',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Removed', content: { 'application/json': { schema: SuccessSchema } } } },
})

registry.registerPath({
  method: 'post', path: '/api/v1/users/onboarding/complete', tags: ['Users'],
  summary: 'Mark onboarding as completed',
  security: [{ [BearerAuth.name]: [] }],
  responses: { 200: { description: 'Onboarding completed', content: { 'application/json': { schema: SuccessSchema } } } },
})

// ── Admin extended ────────────────────────────────────────────────────────────
registry.registerPath({
  method: 'get', path: '/api/v1/admin/export/workers', tags: ['Admin'],
  summary: 'Export workers as CSV or JSON (admin, 1/min rate limit)',
  security: [{ [BearerAuth.name]: [] }],
  request: { query: z.object({ format: z.enum(['csv', 'json']).optional() }) },
  responses: {
    200: { description: 'Exported data (application/json or text/csv)' },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'get', path: '/api/v1/admin/export/users', tags: ['Admin'],
  summary: 'Export users as CSV or JSON (admin, 1/min rate limit)',
  security: [{ [BearerAuth.name]: [] }],
  request: { query: z.object({ format: z.enum(['csv', 'json']).optional() }) },
  responses: {
    200: { description: 'Exported data (application/json or text/csv)' },
    429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

registry.registerPath({
  method: 'post', path: '/api/v1/admin/workers/import', tags: ['Admin'],
  summary: 'Bulk import workers from CSV (admin)',
  security: [{ [BearerAuth.name]: [] }],
  request: { body: { content: { 'multipart/form-data': { schema: z.object({ file: z.string().describe('CSV file (max 5 MB)') }) } } } },
  responses: {
    200: { description: 'Import results', content: { 'application/json': { schema: z.object({ status: z.literal('success'), data: z.object({ imported: z.number(), failed: z.number(), errors: z.array(z.string()) }) }) } } },
    400: { description: 'Invalid CSV', content: { 'application/json': { schema: ErrorSchema } } },
  },
})

// ── Generate ──────────────────────────────────────────────────────────────────
export function buildSpec() {
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: { title: 'BlueCollar API', version: '1.0.0', description: 'Decentralised skilled-worker marketplace built on Stellar.' },
    servers: [{ url: 'http://localhost:3000', description: 'Local' }],
  })
}
