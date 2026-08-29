/**
 * Integration tests for wallet endpoints — packages/api/src/__tests__/integration/wallet.test.ts
 *
 * Exercises the full HTTP stack (route → controller → service) while mocking
 * the database and Stellar Horizon HTTP calls.
 *
 * Issue: #1006 [Backend] Add integration tests for wallets endpoints
 */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'

// ─── Env setup ────────────────────────────────────────────────────────────────
process.env.JWT_SECRET = 'test-wallet-secret'
process.env.APP_URL = 'http://localhost:3000'
process.env.NODE_ENV = 'test'

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../db.js', () => ({
  db: {
    stellarAccount: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('../../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-wallet-secret',
    DATABASE_URL: 'postgresql://localhost:5432/test',
    PORT: 3000,
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    MAIL_HOST: 'smtp.test.local',
    MAIL_PORT: 587,
    MAIL_USER: 'test-user',
    MAIL_PASS: 'test-pass',
    APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'test' }) },
}))

vi.mock('../../mailer/index.js', () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendModerationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../config/redis.js', () => ({
  redis: {
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn().mockResolvedValue('PONG'),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    quit: vi.fn().mockResolvedValue(undefined),
  },
  cacheMetrics: { hits: 0, misses: 0 },
}))

vi.mock('../../monitoring/tracing.js', () => ({
  initializeTracing: vi.fn(),
}))

vi.mock('../../services/reminder.service.js', () => ({
  startReminderScheduler: vi.fn(),
}))

vi.mock('../../services/horizon-poller.service.js', () => ({
  startHorizonPoller: vi.fn(),
}))

vi.mock('../../monitoring/business-metrics.js', () => ({
  metricsRecorder: { startPeriodicSync: vi.fn() },
}))

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { db } from '../../db.js'
import app from '../../app.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_PUBLIC_KEY = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'

function authToken(userId = 'user-wallet-1', role = 'user') {
  return jwt.sign({ id: userId, role }, 'test-wallet-secret', { expiresIn: '1h' })
}

function makeAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: 'account-1',
    publicKey: VALID_PUBLIC_KEY,
    userId: 'user-wallet-1',
    balance: 1000.5,
    sequences: BigInt(12345678),
    lastSyncedAt: new Date(),
    ...overrides,
  }
}

/** Build a minimal mock fetch that returns Horizon account data */
function mockHorizonAccount(overrides: Record<string, unknown> = {}) {
  return {
    balances: [{ balance: '1000.5000000', asset_type: 'native' }],
    sequence: '12345678',
    ...overrides,
  }
}

// ─── GET /api/wallet/balance ──────────────────────────────────────────────────

describe('GET /api/wallet/balance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 200 with balance data when account is linked', async () => {
    vi.mocked(db.stellarAccount.findFirst).mockResolvedValue(makeAccount() as never)

    const res = await request(app)
      .get('/api/wallet/balance')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data.publicKey).toBe(VALID_PUBLIC_KEY)
    expect(res.body.data.balance).toBe(1000.5)
  })

  it('returns 404 when no Stellar account is linked', async () => {
    vi.mocked(db.stellarAccount.findFirst).mockResolvedValue(null as never)

    const res = await request(app)
      .get('/api/wallet/balance')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(404)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/wallet/balance')

    expect(res.status).toBe(401)
  })
})

// ─── GET /api/wallet/account/:publicKey ──────────────────────────────────────

describe('GET /api/wallet/account/:publicKey', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('returns 200 with account info from Horizon', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHorizonAccount(),
    }))

    const res = await request(app).get(`/api/wallet/account/${VALID_PUBLIC_KEY}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data.publicKey).toBe(VALID_PUBLIC_KEY)
    expect(res.body.data.balance).toBe(1000.5)
  })

  it('returns 404 when Horizon says account not found', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }))

    const res = await request(app).get('/api/wallet/account/INVALID000NOTFOUND0000000000000000000000000000000000000000')

    expect(res.status).toBe(404)
  })

  it('is a public endpoint (no auth required)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHorizonAccount(),
    }))

    const res = await request(app).get(`/api/wallet/account/${VALID_PUBLIC_KEY}`)
    // Should not get 401
    expect(res.status).not.toBe(401)
  })
})

// ─── POST /api/wallet/link ────────────────────────────────────────────────────

describe('POST /api/wallet/link', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('returns 201 when wallet is successfully linked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHorizonAccount(),
    }))
    vi.mocked(db.stellarAccount.findUnique).mockResolvedValue(null as never)
    vi.mocked(db.stellarAccount.upsert).mockResolvedValue(makeAccount() as never)

    const res = await request(app)
      .post('/api/wallet/link')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ publicKey: VALID_PUBLIC_KEY })

    expect(res.status).toBe(201)
    expect(res.body.status).toBe('success')
    expect(res.body.message).toMatch(/wallet linked/i)
  })

  it('returns 400 for invalid public key (wrong length)', async () => {
    const res = await request(app)
      .post('/api/wallet/link')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ publicKey: 'TOOSHORT' })

    expect(res.status).toBe(400)
  })

  it('returns 400 when wallet is already linked to another user', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHorizonAccount(),
    }))
    // Account exists and belongs to a different user
    vi.mocked(db.stellarAccount.findUnique).mockResolvedValue(
      makeAccount({ userId: 'different-user' }) as never,
    )

    const res = await request(app)
      .post('/api/wallet/link')
      .set('Authorization', `Bearer ${authToken('user-wallet-1')}`)
      .send({ publicKey: VALID_PUBLIC_KEY })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/already linked/i)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/wallet/link')
      .send({ publicKey: VALID_PUBLIC_KEY })

    expect(res.status).toBe(401)
  })

  it('re-linking same wallet to same user succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHorizonAccount(),
    }))
    // Account already exists for THIS user — should succeed
    vi.mocked(db.stellarAccount.findUnique).mockResolvedValue(makeAccount() as never)
    vi.mocked(db.stellarAccount.upsert).mockResolvedValue(makeAccount() as never)

    const res = await request(app)
      .post('/api/wallet/link')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ publicKey: VALID_PUBLIC_KEY })

    expect(res.status).toBe(201)
  })
})

// ─── POST /api/wallet/build-tx ────────────────────────────────────────────────

describe('POST /api/wallet/build-tx', () => {
  const DEST_KEY = 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPGZWXNUAMLSP4JK7DOBRE3SXX'

  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('returns 200 with transaction parameters', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHorizonAccount(),
    }))
    vi.mocked(db.stellarAccount.findUnique).mockResolvedValue(makeAccount() as never)

    const res = await request(app)
      .post('/api/wallet/build-tx')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({
        sourcePublicKey: VALID_PUBLIC_KEY,
        destinationPublicKey: DEST_KEY,
        amount: '10.0',
        memo: 'Test payment',
      })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data.sourcePublicKey).toBe(VALID_PUBLIC_KEY)
    expect(res.body.data.destinationPublicKey).toBe(DEST_KEY)
    expect(res.body.data.amount).toBe('10.0')
  })

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/api/wallet/build-tx')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ sourcePublicKey: VALID_PUBLIC_KEY })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/missing required fields/i)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).post('/api/wallet/build-tx').send({
      sourcePublicKey: VALID_PUBLIC_KEY,
      destinationPublicKey: DEST_KEY,
      amount: '10.0',
    })

    expect(res.status).toBe(401)
  })
})

// ─── POST /api/wallet/broadcast ───────────────────────────────────────────────

describe('POST /api/wallet/broadcast', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('returns 200 with transaction hash on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hash: 'abc123txhash', id: 'tx-id-1' }),
    }))

    const res = await request(app)
      .post('/api/wallet/broadcast')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ signedXdr: 'AAAA...signedxdr' })

    expect(res.status).toBe(200)
    expect(res.body.data.txHash).toBe('abc123txhash')
  })

  it('returns 400 when signedXdr is missing', async () => {
    const res = await request(app)
      .post('/api/wallet/broadcast')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/signedXdr is required/i)
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/wallet/broadcast')
      .send({ signedXdr: 'some-xdr' })

    expect(res.status).toBe(401)
  })

  it('returns error status when Horizon rejects the transaction', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ title: 'Transaction Failed', detail: 'Bad sequence' }),
    }))

    const res = await request(app)
      .post('/api/wallet/broadcast')
      .set('Authorization', `Bearer ${authToken()}`)
      .send({ signedXdr: 'invalid-xdr' })

    expect(res.status).toBe(400)
  })
})

// ─── GET /api/wallet/tx-status/:txHash ───────────────────────────────────────

describe('GET /api/wallet/tx-status/:txHash', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('returns confirmed status for a successful transaction', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ successful: true, result_code: 'success' }),
    }))

    const res = await request(app)
      .get('/api/wallet/tx-status/abc123hash')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('confirmed')
  })

  it('returns pending when Horizon returns 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }))

    const res = await request(app)
      .get('/api/wallet/tx-status/pending123')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('pending')
  })

  it('returns failed status for an unsuccessful transaction', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ successful: false, result_code: 'tx_failed' }),
    }))

    const res = await request(app)
      .get('/api/wallet/tx-status/failed456')
      .set('Authorization', `Bearer ${authToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('failed')
  })

  it('returns 401 when not authenticated', async () => {
    const res = await request(app).get('/api/wallet/tx-status/somehash')

    expect(res.status).toBe(401)
  })
})

// ─── POST /api/wallet/testnet-fund ───────────────────────────────────────────

describe('POST /api/wallet/testnet-fund', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('returns 200 on successful testnet funding', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hash: 'friendbot-tx-hash' }),
    }))

    const res = await request(app)
      .post('/api/wallet/testnet-fund')
      .send({ publicKey: VALID_PUBLIC_KEY })

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('success')
    expect(res.body.data.txHash).toBe('friendbot-tx-hash')
  })

  it('returns 400 when publicKey is missing', async () => {
    const res = await request(app).post('/api/wallet/testnet-fund').send({})

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/publicKey is required/i)
  })

  it('is a public endpoint (no auth required)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ hash: 'friendbot-tx-hash' }),
    }))

    const res = await request(app)
      .post('/api/wallet/testnet-fund')
      .send({ publicKey: VALID_PUBLIC_KEY })

    expect(res.status).not.toBe(401)
  })
})

// ─── GET /api/wallet/transactions/:publicKey ──────────────────────────────────

describe('GET /api/wallet/transactions/:publicKey', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it('returns 200 with transaction list', async () => {
    const mockTxList = [
      { hash: 'tx1', created_at: '2024-01-01T00:00:00Z' },
      { hash: 'tx2', created_at: '2024-01-02T00:00:00Z' },
    ]
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { records: mockTxList } }),
    }))

    const res = await request(app).get(`/api/wallet/transactions/${VALID_PUBLIC_KEY}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(2)
    expect(res.body.data[0].hash).toBe('tx1')
  })

  it('returns 200 with empty list when no transactions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { records: [] } }),
    }))

    const res = await request(app).get(`/api/wallet/transactions/${VALID_PUBLIC_KEY}`)

    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(0)
  })

  it('is a public endpoint (no auth required)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ _embedded: { records: [] } }),
    }))

    const res = await request(app).get(`/api/wallet/transactions/${VALID_PUBLIC_KEY}`)
    expect(res.status).not.toBe(401)
  })
})
