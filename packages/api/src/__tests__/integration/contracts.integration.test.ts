/**
 * Integration tests for contracts endpoints (#1003)
 *
 * Covers:
 *  Escrow:
 *    - GET    /api/escrow
 *    - GET    /api/escrow/:id
 *    - POST   /api/escrow
 *    - PATCH  /api/escrow/:id/activate
 *    - PATCH  /api/escrow/:id/release
 *    - PATCH  /api/escrow/:id/cancel
 *    - POST   /api/escrow/:id/disputes
 *    - PATCH  /api/escrow/:id/disputes/:disputeId (admin only)
 *
 *  Disputes:
 *    - POST   /api/disputes
 *    - GET    /api/disputes
 *    - GET    /api/disputes/:id
 *    - PATCH  /api/disputes/:id/resolve (admin only)
 *
 * All DB / Redis / external deps are mocked; the full HTTP cycle is
 * exercised via supertest against the real Express app.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─── Environment ─────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-integration-secret'
process.env.DATABASE_URL = 'postgresql://localhost:5432/test'
process.env.REDIS_URL = 'redis://localhost:6379'
process.env.APP_URL = 'http://localhost:3000'

// ─── Mocks ────────────────────────────────────────────────────────────────────
vi.mock('../../db.js', () => ({
  db: {
    escrowRecord: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    dispute: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
    user: { findUnique: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  },
}))

vi.mock('../../config/redis.js', () => ({
  redis: { connect: vi.fn().mockResolvedValue(undefined), ping: vi.fn().mockResolvedValue('PONG') },
  cacheMetrics: { hits: 0, misses: 0 },
}))

vi.mock('../../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost:5432/test',
    JWT_SECRET: 'test-integration-secret',
    PORT: 3000,
    GOOGLE_CLIENT_ID: 'test',
    GOOGLE_CLIENT_SECRET: 'test',
    MAIL_HOST: 'smtp.test.local',
    MAIL_PORT: 587,
    MAIL_USER: 'test',
    MAIL_PASS: 'test',
    APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('../../openapi/docs.js', () => {
  const fn = (_: any, __: any, next: any) => next()
  fn.use = fn; fn.get = fn; fn.handle = fn
  return { default: fn }
})

vi.mock('../../config/passport.js', () => ({
  default: {
    initialize: () => (_: any, __: any, next: any) => next(),
    authenticate: () => (_: any, __: any, next: any) => next(),
  },
}))

vi.mock('../../middleware/requestLogger.js', () => ({
  requestLogger: (_: any, __: any, next: any) => next(),
}))

vi.mock('../../events/index.js', () => ({ registerEventHandlers: vi.fn() }))

vi.mock('../../config/rateLimiter.js', () => ({
  moderateAuthRateLimiter: (_: any, __: any, next: any) => next(),
  strictAuthRateLimiter: (_: any, __: any, next: any) => next(),
}))

vi.mock('../../middleware/versionRateLimit.js', () => ({
  versionRateLimit: () => (_: any, __: any, next: any) => next(),
  getRateLimitStatus: (_: any, res: any) => res.json({ status: 'ok' }),
}))

vi.mock('../../middleware/userRateLimit.js', () => ({
  contactRateLimit: (_: any, __: any, next: any) => next(),
  generalRateLimit: (_: any, __: any, next: any) => next(),
  userRateLimit: () => (_: any, __: any, next: any) => next(),
}))

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg' }) },
}))

// Mock contracts service
vi.mock('../../services/contracts.service.js', () => ({
  createEscrowRecord: vi.fn(),
  activateEscrowRecord: vi.fn(),
  fileEscrowDispute: vi.fn(),
  resolveEscrowDispute: vi.fn(),
  fileWorkerDispute: vi.fn(),
  escrow: {
    listEscrows: vi.fn(),
    getEscrow: vi.fn(),
    releaseEscrow: vi.fn(),
    cancelEscrow: vi.fn(),
  },
  dispute: {
    listDisputes: vi.fn(),
    getDispute: vi.fn(),
    resolveDispute: vi.fn(),
  },
}))

import app from '../../app.js'
import * as contractsService from '../../services/contracts.service.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeToken(role = 'user', id = 'user-1') {
  return jwt.sign({ id, email: 'user@example.com', role }, 'test-integration-secret', { expiresIn: '1h' })
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const fakeEscrow = {
  id: 'escrow-1',
  jobId: 'job-1',
  payerId: 'user-1',
  payeeId: 'user-2',
  amountXlm: 100,
  status: 'pending',
  expiresAt: new Date(Date.now() + 86400000 * 7),
  txId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const fakeDispute = {
  id: 'dispute-1',
  escrowId: 'escrow-1',
  workerId: 'worker-1',
  filedById: 'user-1',
  reason: 'Payment not received',
  evidence: 'Transaction hash: abc123',
  status: 'pending',
  resolution: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

// ═══ ESCROW TESTS ════════════════════════════════════════════════════════════

describe('GET /api/escrow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.escrow.listEscrows).mockResolvedValue({
      data: [fakeEscrow] as any,
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    })
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/escrow')
    expect(res.status).toBe(401)
  })

  it('returns 200 with escrow list for authenticated user', async () => {
    const token = makeToken('user')
    const res = await request(app).get('/api/escrow').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toHaveLength(1)
  })

  it('calls service with correct user id and role', async () => {
    const token = makeToken('user', 'user-42')
    await request(app).get('/api/escrow').set('Authorization', `Bearer ${token}`)
    expect(vi.mocked(contractsService.escrow.listEscrows)).toHaveBeenCalledWith('user-42', 'user', 1, 20)
  })

  it('passes pagination params to service', async () => {
    const token = makeToken('user')
    await request(app).get('/api/escrow?page=2&limit=10').set('Authorization', `Bearer ${token}`)
    expect(vi.mocked(contractsService.escrow.listEscrows)).toHaveBeenCalledWith('user-1', 'user', 2, 10)
  })
})

describe('GET /api/escrow/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.escrow.getEscrow).mockResolvedValue(fakeEscrow as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/escrow/escrow-1')
    expect(res.status).toBe(401)
  })

  it('returns 200 with escrow details', async () => {
    const token = makeToken('user')
    const res = await request(app).get('/api/escrow/escrow-1').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('escrow-1')
  })

  it('returns 404 when escrow not found', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.escrow.getEscrow).mockRejectedValue(
      new AppError('Escrow not found', 404, true, ErrorCode.NOT_FOUND),
    )
    const token = makeToken('user')
    const res = await request(app).get('/api/escrow/nonexistent').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 403 when user not authorized to view escrow', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.escrow.getEscrow).mockRejectedValue(
      new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN),
    )
    const token = makeToken('user', 'other-user')
    const res = await request(app).get('/api/escrow/escrow-1').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})

describe('POST /api/escrow', () => {
  const validBody = {
    payeeId: 'user-2',
    amountXlm: 100,
    expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
    jobId: 'job-1',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.createEscrowRecord).mockResolvedValue(fakeEscrow as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/escrow').send(validBody)
    expect(res.status).toBe(401)
  })

  it('returns 201 when escrow is created', async () => {
    const token = makeToken('user')
    const res = await request(app).post('/api/escrow').set('Authorization', `Bearer ${token}`).send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
    expect(res.body.data.id).toBe('escrow-1')
  })

  it('calls service with correct payer id', async () => {
    const token = makeToken('user', 'payer-99')
    await request(app).post('/api/escrow').set('Authorization', `Bearer ${token}`).send(validBody)
    expect(vi.mocked(contractsService.createEscrowRecord)).toHaveBeenCalledWith(
      'payer-99',
      expect.objectContaining({ payeeId: 'user-2', amountXlm: 100 }),
    )
  })

  it('returns 400 when payeeId is missing', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.createEscrowRecord).mockRejectedValue(
      new AppError('payeeId, amountXlm and expiresAt are required', 400, true, ErrorCode.VALIDATION_ERROR),
    )
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/escrow')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, payeeId: undefined })
    expect(res.status).toBe(400)
  })

  it('returns 400 when amountXlm is missing', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.createEscrowRecord).mockRejectedValue(
      new AppError('payeeId, amountXlm and expiresAt are required', 400, true, ErrorCode.VALIDATION_ERROR),
    )
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/escrow')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validBody, amountXlm: undefined })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/escrow/:id/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.activateEscrowRecord).mockResolvedValue({
      ...fakeEscrow,
      status: 'active',
      txId: 'tx-abc123',
    } as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/escrow/escrow-1/activate').send({ txId: 'tx-abc123' })
    expect(res.status).toBe(401)
  })

  it('returns 200 when activation succeeds', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .patch('/api/escrow/escrow-1/activate')
      .set('Authorization', `Bearer ${token}`)
      .send({ txId: 'tx-abc123' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('active')
  })

  it('returns 400 when txId is missing', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.activateEscrowRecord).mockRejectedValue(
      new AppError('txId is required', 400, true, ErrorCode.VALIDATION_ERROR),
    )
    const token = makeToken('user')
    const res = await request(app)
      .patch('/api/escrow/escrow-1/activate')
      .set('Authorization', `Bearer ${token}`)
      .send({})
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/escrow/:id/release', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.escrow.releaseEscrow).mockResolvedValue({
      ...fakeEscrow,
      status: 'released',
    } as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/escrow/escrow-1/release')
    expect(res.status).toBe(401)
  })

  it('returns 200 when release succeeds', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .patch('/api/escrow/escrow-1/release')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('released')
  })
})

describe('PATCH /api/escrow/:id/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.escrow.cancelEscrow).mockResolvedValue({
      ...fakeEscrow,
      status: 'cancelled',
    } as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/escrow/escrow-1/cancel')
    expect(res.status).toBe(401)
  })

  it('returns 200 when cancellation succeeds', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .patch('/api/escrow/escrow-1/cancel')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('cancelled')
  })
})

describe('POST /api/escrow/:id/disputes', () => {
  const validBody = {
    reason: 'Payment not received after 7 days',
    evidence: 'Transaction ID: tx-abc123, no confirmation received',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.fileEscrowDispute).mockResolvedValue(fakeDispute as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/escrow/escrow-1/disputes').send(validBody)
    expect(res.status).toBe(401)
  })

  it('returns 201 when dispute is filed', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/escrow/escrow-1/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
  })

  it('returns 400 when reason is missing', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.fileEscrowDispute).mockRejectedValue(
      new AppError('reason is required', 400, true, ErrorCode.VALIDATION_ERROR),
    )
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/escrow/escrow-1/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({ evidence: 'Some evidence' })
    expect(res.status).toBe(400)
  })
})

describe('PATCH /api/escrow/:id/disputes/:disputeId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.resolveEscrowDispute).mockResolvedValue({
      ...fakeDispute,
      status: 'resolved',
      resolution: 'Refund issued to payer',
    } as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch('/api/escrow/escrow-1/disputes/dispute-1')
      .send({ status: 'resolved', resolution: 'Refund issued' })
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .patch('/api/escrow/escrow-1/disputes/dispute-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved', resolution: 'Refund issued' })
    expect(res.status).toBe(403)
  })

  it('returns 200 for admin user when resolution succeeds', async () => {
    const token = makeToken('admin')
    const res = await request(app)
      .patch('/api/escrow/escrow-1/disputes/dispute-1')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'resolved', resolution: 'Refund issued to payer' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('resolved')
  })
})

// ═══ DISPUTES TESTS ══════════════════════════════════════════════════════════

describe('POST /api/disputes', () => {
  const validBody = {
    workerId: 'worker-1',
    reason: 'Worker did not complete the job as agreed',
    evidence: 'Photos and messages proving incomplete work',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.fileWorkerDispute).mockResolvedValue(fakeDispute as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/disputes').send(validBody)
    expect(res.status).toBe(401)
  })

  it('returns 201 when dispute is filed successfully', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
  })

  it('calls service with correct args', async () => {
    const token = makeToken('user', 'filer-99')
    await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(vi.mocked(contractsService.fileWorkerDispute)).toHaveBeenCalledWith(
      'worker-1',
      'filer-99',
      validBody.reason,
      validBody.evidence,
    )
  })

  it('returns 400 when workerId is missing', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.fileWorkerDispute).mockRejectedValue(
      new AppError('workerId and reason are required', 400, true, ErrorCode.VALIDATION_ERROR),
    )
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({ reason: validBody.reason })
    expect(res.status).toBe(400)
  })

  it('returns 400 when reason is missing', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.fileWorkerDispute).mockRejectedValue(
      new AppError('workerId and reason are required', 400, true, ErrorCode.VALIDATION_ERROR),
    )
    const token = makeToken('user')
    const res = await request(app)
      .post('/api/disputes')
      .set('Authorization', `Bearer ${token}`)
      .send({ workerId: 'worker-1' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/disputes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.dispute.listDisputes).mockResolvedValue({
      data: [fakeDispute] as any,
      meta: { total: 1, page: 1, limit: 20, pages: 1 },
    })
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/disputes')
    expect(res.status).toBe(401)
  })

  it('returns 200 with dispute list for authenticated user', async () => {
    const token = makeToken('user')
    const res = await request(app).get('/api/disputes').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data).toHaveLength(1)
  })

  it('calls service with user id and role', async () => {
    const token = makeToken('user', 'user-77')
    await request(app).get('/api/disputes').set('Authorization', `Bearer ${token}`)
    expect(vi.mocked(contractsService.dispute.listDisputes)).toHaveBeenCalledWith('user-77', 'user', 1, 20)
  })

  it('admin can list all disputes', async () => {
    vi.mocked(contractsService.dispute.listDisputes).mockResolvedValue({
      data: [fakeDispute, { ...fakeDispute, id: 'dispute-2' }] as any,
      meta: { total: 2, page: 1, limit: 20, pages: 1 },
    })
    const token = makeToken('admin')
    const res = await request(app).get('/api/disputes').set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
  })

  it('passes pagination params to service', async () => {
    const token = makeToken('user')
    await request(app).get('/api/disputes?page=2&limit=5').set('Authorization', `Bearer ${token}`)
    expect(vi.mocked(contractsService.dispute.listDisputes)).toHaveBeenCalledWith('user-1', 'user', 2, 5)
  })
})

describe('GET /api/disputes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.dispute.getDispute).mockResolvedValue(fakeDispute as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/disputes/dispute-1')
    expect(res.status).toBe(401)
  })

  it('returns 200 with dispute details', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .get('/api/disputes/dispute-1')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('dispute-1')
    expect(res.body.data.reason).toBe('Payment not received')
  })

  it('returns 404 when dispute not found', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.dispute.getDispute).mockRejectedValue(
      new AppError('Dispute not found', 404, true, ErrorCode.NOT_FOUND),
    )
    const token = makeToken('user')
    const res = await request(app)
      .get('/api/disputes/nonexistent')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('returns 403 when user is not authorized to view the dispute', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.dispute.getDispute).mockRejectedValue(
      new AppError('Forbidden', 403, true, ErrorCode.FORBIDDEN),
    )
    const token = makeToken('user', 'other-user')
    const res = await request(app)
      .get('/api/disputes/dispute-1')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/disputes/:id/resolve', () => {
  const validBody = { status: 'resolved', resolution: 'Worker issued a full refund' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(contractsService.dispute.resolveDispute).mockResolvedValue({
      ...fakeDispute,
      status: 'resolved',
      resolution: 'Worker issued a full refund',
    } as any)
  })

  it('returns 401 without auth token', async () => {
    const res = await request(app).patch('/api/disputes/dispute-1/resolve').send(validBody)
    expect(res.status).toBe(401)
  })

  it('returns 403 for non-admin user', async () => {
    const token = makeToken('user')
    const res = await request(app)
      .patch('/api/disputes/dispute-1/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(res.status).toBe(403)
  })

  it('returns 200 for admin user', async () => {
    const token = makeToken('admin')
    const res = await request(app)
      .patch('/api/disputes/dispute-1/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('resolved')
    expect(res.body.data.resolution).toBe('Worker issued a full refund')
  })

  it('calls service with correct args', async () => {
    const token = makeToken('admin', 'admin-1')
    await request(app)
      .patch('/api/disputes/dispute-1/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send(validBody)
    expect(vi.mocked(contractsService.dispute.resolveDispute)).toHaveBeenCalledWith(
      'dispute-1',
      'admin-1',
      'resolved',
      'Worker issued a full refund',
    )
  })

  it('returns 400 for invalid status', async () => {
    const { AppError, ErrorCode } = await import('../../utils/AppError.js')
    vi.mocked(contractsService.dispute.resolveDispute).mockRejectedValue(
      new AppError('status must be under_review, resolved, or dismissed', 400, true, ErrorCode.VALIDATION_ERROR),
    )
    const token = makeToken('admin')
    const res = await request(app)
      .patch('/api/disputes/dispute-1/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'bad-status' })
    expect(res.status).toBe(400)
  })
})
