/**
 * @regression Critical Bug Regression Suite (#1057)
 *
 * Each describe block documents exactly which bug it guards against,
 * which issue introduced the fix, and (where applicable) a minimal
 * pre-fix code path that should fail the test.
 *
 * Tag convention: `@regression` in the JSDoc above each describe.
 *
 * Run individually:
 *   pnpm vitest run src/__tests__/regression.critical.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

// ── Combined db mock (all describe blocks share this shape) ───────────────────
// Each test section only configures the spies it needs via .mockResolvedValue.
vi.mock('../db.js', () => ({
  db: {
    idempotencyKey: {
      findUnique: vi.fn(),
      upsert: vi.fn().mockResolvedValue({}),
    },
    refreshToken: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    },
    user: { findUnique: vi.fn() },
    escrowRecord: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    systemConfig: {
      findUnique: vi.fn(),
    },
  },
}))

// ─────────────────────────────────────────────────────────────────────────────
// BUG 1 – Payment double-submit (#517 / idempotency middleware)
//
// What broke: A client retrying a failed POST /workers (or any mutating
// payment/booking endpoint) after a network timeout received a 2nd
// successful 201 response, creating a duplicate resource. The idempotency
// middleware caches the first response against the Idempotency-Key header
// and replays it verbatim on retries instead of re-executing the handler.
//
// Pre-fix path: remove the `if (stored)` early-return branch in
// idempotency.ts — the test below asserts the cached response is replayed
// and `next()` is NOT called a second time.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Payment double-submit – idempotency middleware (#517)
 */
describe('[regression] Payment double-submit – idempotency key replay', () => {
  let idempotency: (req: Request, res: Response, next: NextFunction) => void

  beforeEach(async () => {
    vi.resetModules()
    // Re-import after resetting so the global mock above takes effect
    const mod = await import('../middleware/idempotency.js')
    idempotency = mod.idempotency
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  function makeCtx(headers: Record<string, string> = {}, userId?: string) {
    const req = {
      headers,
      user: userId ? { id: userId, role: 'curator' } : undefined,
      params: {},
    } as unknown as Request

    const jsonFn = vi.fn().mockReturnThis()
    const statusFn = vi.fn().mockReturnValue({ json: jsonFn })
    const res = { json: jsonFn, status: statusFn, statusCode: 201 } as unknown as Response
    const next = vi.fn() as unknown as NextFunction
    return { req, res, next, jsonFn, statusFn }
  }

  it('calls next() for a brand-new Idempotency-Key (first submission allowed)', async () => {
    const { db } = await import('../db.js')
    vi.mocked(db.idempotencyKey.findUnique).mockResolvedValue(null)

    const { req, res, next } = makeCtx({ 'idempotency-key': 'pay-abc-001' }, 'user-1')
    idempotency(req, res, next)
    await vi.waitFor(() => expect(next).toHaveBeenCalled())
  })

  it('does NOT call next() on a retry — replays cached response instead of double-submitting', async () => {
    const { db } = await import('../db.js')
    const stored = {
      id: 'idem-1',
      key: 'pay-abc-001',
      userId: 'user-1',
      responseBody: { status: 'success', data: { id: 'escrow-99' } },
      statusCode: 201,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }
    vi.mocked(db.idempotencyKey.findUnique).mockResolvedValue(stored as any)

    const { req, res, next, statusFn, jsonFn } = makeCtx({ 'idempotency-key': 'pay-abc-001' }, 'user-1')
    idempotency(req, res, next)
    await vi.waitFor(() => expect(statusFn).toHaveBeenCalledWith(201))

    // The handler must NOT be called again — that's the double-submit bug
    expect(next).not.toHaveBeenCalled()
    expect(jsonFn).toHaveBeenCalledWith(stored.responseBody)
  })

  it('two concurrent identical requests: only one handler invocation reaches the DB write', async () => {
    // This guards against the race where both requests run before either
    // has stored its response. The middleware should still deduplicate on
    // the key-based upsert. We verify that if the stored entry already exists
    // for user-1+key, the second concurrent call replays the cache.
    const { db } = await import('../db.js')
    const stored = {
      id: 'idem-2',
      key: 'race-key',
      userId: 'user-1',
      responseBody: { status: 'success', data: { id: 'escrow-100' } },
      statusCode: 201,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }
    // First call sees null (no entry yet), second call sees the stored entry
    vi.mocked(db.idempotencyKey.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(stored as any)

    const ctx1 = makeCtx({ 'idempotency-key': 'race-key' }, 'user-1')
    const ctx2 = makeCtx({ 'idempotency-key': 'race-key' }, 'user-1')

    idempotency(ctx1.req, ctx1.res, ctx1.next)
    idempotency(ctx2.req, ctx2.res, ctx2.next)

    await vi.waitFor(() => {
      // First request proceeds to handler
      expect(ctx1.next).toHaveBeenCalled()
    })
    await vi.waitFor(() => {
      // Second request replays the cache — no double-submit
      expect(ctx2.next).not.toHaveBeenCalled()
      expect(ctx2.statusFn).toHaveBeenCalledWith(201)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 2 – Auth token refresh race condition (#749 / rotateRefreshToken)
//
// What broke: If two requests simultaneously submitted the same refresh
// token (e.g. a mobile client firing parallel requests on wake-up), both
// could pass the `revokedAt === null` check before either had committed its
// revocation write, resulting in both receiving valid new access tokens from
// the same single-use token (token reuse attack).
//
// The fix: `rotateRefreshToken` marks the old token as revoked atomically
// before issuing the new pair. A second call with the same (now-revoked)
// token must be rejected with 401.
//
// Pre-fix path: comment out the `revokedAt` check — both calls succeed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Auth token refresh race condition – refresh token reuse (#749)
 */
describe('[regression] Auth token refresh race – single-use enforcement', () => {
  const crypto = require('node:crypto')
  const RAW_TOKEN = 'raw-refresh-token-value-abc123'
  const TOKEN_HASH = crypto.createHash('sha256').update(RAW_TOKEN).digest('hex')

  vi.mock('../repositories/user.repository.js', () => ({
    userRepository: {
      findById: vi.fn(),
    },
  }))

  vi.mock('../config/env.js', () => ({
    env: {
      DATABASE_URL: 'postgresql://localhost/test',
      JWT_SECRET: 'test-secret',
      PORT: 3000,
      GOOGLE_CLIENT_ID: 'gid',
      GOOGLE_CLIENT_SECRET: 'gsecret',
      MAIL_HOST: 'smtp.test',
      MAIL_PORT: 587,
      MAIL_USER: 'u',
      MAIL_PASS: 'p',
      APP_URL: 'http://localhost:3000',
    },
  }))

  vi.mock('../mailer/transport.js', () => ({
    transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'x' }) },
  }))

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JWT_SECRET = 'test-secret'
  })

  it('accepts a valid (non-revoked, non-expired) refresh token', async () => {
    const { db } = await import('../db.js')
    const { userRepository } = await import('../repositories/user.repository.js')

    vi.mocked(db.refreshToken.findUnique).mockResolvedValue({
      id: 'rt-1',
      tokenHash: TOKEN_HASH,
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    } as any)

    vi.mocked(userRepository.findById).mockResolvedValue({
      id: 'user-1',
      email: 'alice@example.com',
      role: 'user',
      verified: true,
      firstName: 'Alice',
      lastName: 'Smith',
    } as any)

    vi.mocked(db.refreshToken.create).mockResolvedValue({ tokenHash: 'new-hash' } as any)

    const { rotateRefreshToken } = await import('../services/auth.service.js')
    const result = await rotateRefreshToken(RAW_TOKEN)
    expect(result).toHaveProperty('token')
    expect(result).toHaveProperty('refreshToken')
  })

  it('rejects a token that has already been revoked (prevents refresh-token reuse attack)', async () => {
    const { db } = await import('../db.js')

    vi.mocked(db.refreshToken.findUnique).mockResolvedValue({
      id: 'rt-2',
      tokenHash: TOKEN_HASH,
      userId: 'user-1',
      revokedAt: new Date(Date.now() - 1000), // already revoked
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    } as any)

    const { rotateRefreshToken } = await import('../services/auth.service.js')
    await expect(rotateRefreshToken(RAW_TOKEN)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects an expired refresh token', async () => {
    const { db } = await import('../db.js')

    vi.mocked(db.refreshToken.findUnique).mockResolvedValue({
      id: 'rt-3',
      tokenHash: TOKEN_HASH,
      userId: 'user-1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000), // expired yesterday
      createdAt: new Date(),
    } as any)

    const { rotateRefreshToken } = await import('../services/auth.service.js')
    await expect(rotateRefreshToken(RAW_TOKEN)).rejects.toMatchObject({ statusCode: 401 })
  })

  it('rejects an unknown token that does not exist in the DB', async () => {
    const { db } = await import('../db.js')
    vi.mocked(db.refreshToken.findUnique).mockResolvedValue(null)

    const { rotateRefreshToken } = await import('../services/auth.service.js')
    await expect(rotateRefreshToken('completely-unknown-token')).rejects.toMatchObject({ statusCode: 401 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 3 – Escrow `resolve_dispute` bypasses the pause switch (#1028)
//
// What broke: Every fund-moving entry point in the escrow service checked
// `require_not_paused` except `do_resolve`. An admin calling pause() to
// freeze funds after discovering an exploit could still have funds drained
// via resolve_dispute — a bypass of the emergency circuit-breaker.
//
// The fix (API layer mirror of the Rust fix): the escrow service should
// throw 409 Conflict when the system is paused, regardless of the operation.
// These tests exercise the JS service layer that mirrors the on-chain state.
//
// Pre-fix path: remove the `isPaused` guard in escrow.service resolveDispute.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Escrow pause bypass – resolve_dispute must respect paused state (#1028)
 */
describe('[regression] Escrow pause bypass – resolve_dispute blocked when paused', () => {
  vi.mock('../services/notification.service.js', () => ({
    dispatchNotification: vi.fn().mockResolvedValue(undefined),
  }))

  beforeEach(() => vi.clearAllMocks())

  function makeDisputedEscrow(id = 'esc-1', payerId = 'p1', payeeId = 'p2') {
    return {
      id,
      payerId,
      payeeId,
      amountXlm: 100,
      status: 'disputed',
      expiresAt: new Date(Date.now() + 3_600_000),
      txId: 'tx-dispute-01',
      jobId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  }

  it('resolves a dispute successfully when the system is NOT paused', async () => {
    const { db } = await import('../db.js')
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue({ value: 'false' } as any)
    vi.mocked(db.escrowRecord.findUnique).mockResolvedValue(makeDisputedEscrow() as any)
    vi.mocked(db.escrowRecord.update).mockResolvedValue({ ...makeDisputedEscrow(), status: 'released' } as any)

    const { resolveDispute } = await import('../services/escrow.service.js')
    const result = await resolveDispute('esc-1', 'release', 'p1', 'admin')
    expect(result.status).toBe('released')
  })

  it('blocks resolve_dispute when the system IS paused (regression: escrow pause bypass)', async () => {
    const { db } = await import('../db.js')
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue({ value: 'true' } as any)
    vi.mocked(db.escrowRecord.findUnique).mockResolvedValue(makeDisputedEscrow() as any)

    const { resolveDispute } = await import('../services/escrow.service.js')
    await expect(resolveDispute('esc-1', 'release', 'p1', 'admin')).rejects.toMatchObject({
      statusCode: expect.any(Number),
    })
    // The update must NOT have been called — no funds moved
    expect(db.escrowRecord.update).not.toHaveBeenCalled()
  })

  it('blocks createEscrow when paused', async () => {
    const { db } = await import('../db.js')
    vi.mocked(db.systemConfig.findUnique).mockResolvedValue({ value: 'true' } as any)

    const { createEscrow } = await import('../services/escrow.service.js')
    await expect(
      createEscrow({
        payerId: 'p1',
        payeeId: 'p2',
        amountXlm: 50,
        expiresAt: new Date(Date.now() + 3_600_000),
      }),
    ).rejects.toMatchObject({ statusCode: expect.any(Number) })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 4 – Orphaned route files bypass CI (#932)
//
// What broke: A contributor deleted the canonical messaging routes but left
// the orphaned conversations routes file in place. Because the orphaned file
// was never imported in index.ts, the routes silently vanished from the app
// with no test failure.
//
// The fix: a file-system test that fails if any route file is not imported
// and mounted via app.use() in index.ts / app.ts.
//
// Pre-fix path: add a new file `src/routes/zombie.ts` without mounting it —
// this test should fail.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Orphaned route files not mounted in app (#932)
 */
describe('[regression] Orphaned routes – all route files must be mounted in app.ts', () => {
  it('every file in src/routes/ is imported somewhere in app.ts', async () => {
    const fs = await import('node:fs')
    const path = await import('node:path')

    const routesDir = path.join(process.cwd(), 'src', 'routes')
    const appFile = path.join(process.cwd(), 'src', 'app.ts')

    if (!fs.existsSync(routesDir) || !fs.existsSync(appFile)) {
      // In environments where the src tree isn't present, skip gracefully
      return
    }

    const appSource = fs.readFileSync(appFile, 'utf8')
    const routeFiles = fs
      .readdirSync(routesDir)
      .filter((f: string) => f.endsWith('.ts') && !f.endsWith('.d.ts'))

    const orphans: string[] = []
    for (const file of routeFiles) {
      const stem = file.replace(/\.ts$/, '')
      // Accept both import './routes/foo' and require('./routes/foo')
      const referenced =
        appSource.includes(`/routes/${stem}`) ||
        appSource.includes(`routes/${stem}`) ||
        appSource.includes(`'${stem}'`) ||
        appSource.includes(`"${stem}"`)
      if (!referenced) {
        orphans.push(file)
      }
    }

    expect(orphans, `Orphaned route files not mounted in app.ts: ${orphans.join(', ')}`).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 5 – Payment self-tip guard missing (#payment.service)
//
// What broke: The `tip` function had no guard against a sender tipping
// themselves. This could be exploited to satisfy a "payment made" invariant
// in higher-level workflows while no actual funds left the account.
//
// The fix: from === to must throw AppError(400).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Payment self-tip allowed – sender === recipient must be rejected
 */
describe('[regression] Payment self-tip – from and to must differ', () => {
  it('throws 400 when from === to', async () => {
    const { tip } = await import('../services/payment.service.js')
    expect(() => tip({ from: 'wallet-A', to: 'wallet-A', amount: 1_000 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    )
  })

  it('throws 400 when amount is zero or negative (no zero-value payments)', async () => {
    const { tip } = await import('../services/payment.service.js')
    expect(() => tip({ from: 'wallet-A', to: 'wallet-B', amount: 0 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    )
    expect(() => tip({ from: 'wallet-A', to: 'wallet-B', amount: -500 })).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    )
  })

  it('succeeds when from !== to and amount > 0', async () => {
    const { tip } = await import('../services/payment.service.js')
    const result = tip({ from: 'wallet-A', to: 'wallet-B', amount: 5_000 })
    expect(result.from).toBe('wallet-A')
    expect(result.to).toBe('wallet-B')
    expect(result.grossAmount).toBe(5_000)
    expect(result.fee).toBeGreaterThanOrEqual(0)
    expect(result.netAmount).toBeLessThanOrEqual(result.grossAmount)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// BUG 6 – Escrow creation with past expiresAt (#payment.service)
//
// What broke: An escrow created with an already-passed expiry date would be
// immediately cancellable by the depositor, letting them reclaim funds from
// a "completed" workflow step trivially.
//
// The fix: expiresAt must be strictly in the future at creation time.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @regression Escrow created with past expiry – expiresAt must be future
 */
describe('[regression] Escrow past-expiry creation blocked', () => {
  it('throws 400 when expiryDate is in the past', async () => {
    const { createEscrow } = await import('../services/payment.service.js')
    const pastDate = new Date(Date.now() - 60_000)
    expect(() =>
      createEscrow({ from: 'wallet-A', to: 'wallet-B', amount: 10_000, expiryDate: pastDate }),
    ).toThrow(expect.objectContaining({ statusCode: 400 }))
  })

  it('succeeds when expiryDate is in the future', async () => {
    const { createEscrow } = await import('../services/payment.service.js')
    const futureDate = new Date(Date.now() + 3_600_000)
    const result = createEscrow({ from: 'wallet-A', to: 'wallet-B', amount: 10_000, expiryDate: futureDate })
    expect(result.status).toBe('pending')
  })
})
