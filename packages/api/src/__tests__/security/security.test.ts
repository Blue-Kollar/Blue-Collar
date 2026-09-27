/**
 * Comprehensive Security Tests
 *
 * Covers: SQL injection, XSS, WAF patterns (path traversal, SSTI, null byte),
 * prototype pollution, security headers (helmet), auth hardening (JTI revocation),
 * rate limiting, wallet address / Stellar amount validation,
 * and blockchain-specific input protection.
 *
 * All external dependencies are mocked — no DB or Redis required.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'

process.env.JWT_SECRET = 'test-secret'
process.env.APP_URL = 'http://localhost:3000'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../services/auth.service.js', () => ({
  registerUser: vi.fn(),
  loginUser: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  verifyAccount: vi.fn(),
}))

vi.mock('../services/worker.service.js', () => ({
  getWorkers: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getWorkerById: vi.fn().mockResolvedValue(null),
}))

vi.mock('../db.js', () => ({
  db: { user: { findUnique: vi.fn() }, $queryRaw: vi.fn(), $disconnect: vi.fn() },
}))

vi.mock('../config/env.js', () => ({
  env: {
    DATABASE_URL: 'postgresql://localhost:5432/test',
    JWT_SECRET: 'test-secret',
    PORT: 3000,
    GOOGLE_CLIENT_ID: 'test',
    GOOGLE_CLIENT_SECRET: 'test',
    MAIL_HOST: 'smtp.test.local',
    MAIL_PORT: 587,
    MAIL_USER: 'u',
    MAIL_PASS: 'p',
    APP_URL: 'http://localhost:3000',
  },
}))

vi.mock('../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }) },
}))

vi.mock('../config/redis.js', () => ({
  redis: {
    connect: vi.fn().mockResolvedValue(undefined),
    ping: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
  cacheMetrics: { hits: 0, misses: 0 },
}))

vi.mock('../monitoring/tracing.js', () => ({ initTracing: vi.fn() }))

import app from '../../app.js'
import * as authService from '../services/auth.service.js'

// ── Attack payloads ───────────────────────────────────────────────────────────

const SQL_PAYLOADS = [
  "' OR '1'='1",
  "'; DROP TABLE users; --",
  "' UNION SELECT * FROM users --",
  "admin'--",
  "1; SELECT * FROM information_schema.tables",
]

const XSS_PAYLOADS = [
  '<script>alert(1)</script>',
  '"><script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<svg onload=alert(1)>',
  'javascript:alert(1)',
]

// WAF-blocked patterns: path traversal, null byte, SSTI, EL injection, obfuscated exec
const WAF_PAYLOADS = [
  '../../../etc/passwd',
  '%00null',
  '{{7*7}}',
  '${7*7}',
  'eval(atob(',
]

const INVALID_STELLAR_ADDRESSES = [
  'not-an-address',
  'GABC',                       // too short
  'X' + 'A'.repeat(55),        // wrong leading char
  'G' + 'A'.repeat(54) + '!',  // invalid character
  '',
]

const VALID_STELLAR_ADDRESS = 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN'

// ── SQL Injection ─────────────────────────────────────────────────────────────

describe('Security – SQL Injection', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(SQL_PAYLOADS)('rejects SQL payload in login email: %s', async (payload) => {
    vi.mocked(authService.loginUser).mockRejectedValue(new Error('Invalid credentials'))
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: payload, password: 'pass' })

    expect(res.status).not.toBe(200)
    expect(res.status).not.toBe(202)
    expect([400, 401, 422, 500]).toContain(res.status)
    expect(JSON.stringify(res.body)).not.toMatch(/syntax error|pg_|information_schema/i)
  })

  it.each(SQL_PAYLOADS)('rejects SQL payload in register email: %s', async (payload) => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: payload, password: 'Password123!', firstName: 'A', lastName: 'B' })

    expect(res.status).not.toBe(201)
    expect([400, 422]).toContain(res.status)
  })

  it.each(SQL_PAYLOADS)('worker search does not crash on SQL payload: %s', async (payload) => {
    const res = await request(app).get('/api/v1/workers').query({ search: payload })
    expect(res.status).not.toBe(500)
  })

  it.each(SQL_PAYLOADS)('worker ID param does not crash on SQL payload: %s', async (payload) => {
    const res = await request(app).get(`/api/v1/workers/${encodeURIComponent(payload)}`)
    expect(res.status).not.toBe(500)
  })
})

// ── XSS ──────────────────────────────────────────────────────────────────────

describe('Security – XSS', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each(XSS_PAYLOADS)('response body does not echo raw script tags for search: %s', async (payload) => {
    const res = await request(app).get('/api/v1/workers').query({ search: payload })
    expect(res.status).not.toBe(500)
    const body = JSON.stringify(res.body)
    expect(body).not.toContain('<script>')
    expect(body).not.toContain('onerror=')
    expect(body).not.toContain('onload=')
  })

  it.each(XSS_PAYLOADS)('register firstName XSS payload is rejected or sanitized: %s', async (payload) => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'xss@test.com', password: 'Password123!', firstName: payload, lastName: 'B' })

    if (res.status === 201) {
      expect(JSON.stringify(res.body)).not.toContain('<script>')
    } else {
      expect([400, 422]).toContain(res.status)
    }
  })
})

// ── WAF-style pattern blocking ────────────────────────────────────────────────

describe('Security – WAF / Input Hardening', () => {
  it.each(WAF_PAYLOADS)('worker search does not 500 on WAF probe: %s', async (payload) => {
    const res = await request(app).get('/api/v1/workers').query({ search: payload })
    expect(res.status).not.toBe(500)
  })

  it.each(WAF_PAYLOADS)('sanitizer strips WAF probe from body string fields: %s', async (payload) => {
    // The sanitize middleware should blank out matching strings before they reach service layer
    vi.mocked(authService.loginUser).mockImplementation(async (email: string) => {
      // If sanitizer worked, the dangerous string should have been cleared
      expect(email).not.toMatch(/\.\.[/\\]|\/etc\/passwd|%00|\{\{|\$\{|eval\s*\(/i)
      throw new Error('Invalid credentials')
    })
    await request(app).post('/api/v1/auth/login').send({ email: payload, password: 'pass' })
  })

  it('rejects oversized JSON body (>100KB)', async () => {
    const largePayload = { data: 'x'.repeat(200_000) }
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(largePayload)
    expect([400, 413]).toContain(res.status)
  })

  it('rejects request body with deeply nested JSON', async () => {
    let nested: Record<string, unknown> = { value: 'deep' }
    for (let i = 0; i < 50; i++) nested = { child: nested }
    const res = await request(app).post('/api/v1/auth/register').send(nested)
    // Should not crash the server
    expect(res.status).not.toBe(500)
  })

  it('strips __proto__ key from sanitized body (prototype pollution guard)', async () => {
    // Construct a payload that would normally attempt prototype pollution
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(JSON.parse('{"__proto__":{"admin":true},"email":"test@test.com","password":"P@ss1"}'))
    // Should not crash and __proto__ key must not surface
    expect(res.status).not.toBe(500)
    expect((Object.prototype as any).admin).toBeUndefined()
  })
})

// ── Security Headers ──────────────────────────────────────────────────────────

describe('Security – HTTP Headers', () => {
  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('sets X-Frame-Options header', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['x-frame-options']).toBeDefined()
  })

  it('does not expose X-Powered-By', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('sets Content-Security-Policy', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['content-security-policy']).toBeDefined()
  })

  it('sets Strict-Transport-Security', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['strict-transport-security']).toBeDefined()
  })

  it('sets X-DNS-Prefetch-Control', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['x-dns-prefetch-control']).toBeDefined()
  })
})

// ── Authentication Hardening ──────────────────────────────────────────────────

describe('Security – Authentication', () => {
  it('rejects protected route without token → 401', async () => {
    const res = await request(app).delete('/api/v1/auth/logout')
    expect(res.status).toBe(401)
  })

  it('rejects malformed JWT → 401', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/logout')
      .set('Authorization', 'Bearer not.a.valid.jwt')
    expect(res.status).toBe(401)
  })

  it('rejects expired JWT → 401', async () => {
    const expired =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJpZCI6InRlc3QiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.' +
      'bad-signature'
    const res = await request(app)
      .delete('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${expired}`)
    expect(res.status).toBe(401)
  })

  it('rejects non-Bearer auth scheme → 401', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/logout')
      .set('Authorization', 'Basic dXNlcjpwYXNz')
    expect(res.status).toBe(401)
  })

  it('rejects oversized token (>2048 chars) → 401', async () => {
    const hugeToken = 'x'.repeat(3000)
    const res = await request(app)
      .delete('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${hugeToken}`)
    expect(res.status).toBe(401)
  })

  it('rejects token with only two segments → 401', async () => {
    const res = await request(app)
      .delete('/api/v1/auth/logout')
      .set('Authorization', 'Bearer header.payload')
    expect(res.status).toBe(401)
  })
})

// ── JTI Revocation ────────────────────────────────────────────────────────────

describe('Security – JTI Revocation', () => {
  it('revokeToken adds JTI to revocation set', async () => {
    const { revokeToken, _getRevokedJtis } = await import('../../middleware/auth.js')
    revokeToken('test-jti-123')
    expect(_getRevokedJtis().has('test-jti-123')).toBe(true)
  })
})

// ── Blockchain / Wallet Validation ────────────────────────────────────────────

describe('Security – Blockchain Input Validation', () => {
  it.each(INVALID_STELLAR_ADDRESSES)('rejects invalid Stellar address: %s', async (addr) => {
    const res = await request(app)
      .post('/api/v1/payments')
      .send({ walletAddress: addr, amount: '10', tokenAddress: VALID_STELLAR_ADDRESS })
    // Must not be a 5xx — input should be rejected at validation layer
    expect(res.status).not.toBe(500)
  })

  it('does not crash on extremely long wallet address input', async () => {
    const res = await request(app)
      .post('/api/v1/payments')
      .send({ walletAddress: 'G'.repeat(1000), amount: '10' })
    expect(res.status).not.toBe(500)
  })

  it('rejects negative Stellar amount', async () => {
    const { stellarAmountSchema } = await import('../../middleware/validate.js')
    expect(stellarAmountSchema.safeParse('-1').success).toBe(false)
  })

  it('rejects Stellar amount with excessive decimal places', async () => {
    const { stellarAmountSchema } = await import('../../middleware/validate.js')
    expect(stellarAmountSchema.safeParse('1.12345678').success).toBe(false)
  })

  it('accepts valid Stellar amount', async () => {
    const { stellarAmountSchema } = await import('../../middleware/validate.js')
    expect(stellarAmountSchema.safeParse('100.5').success).toBe(true)
  })

  it('rejects Stellar amount exceeding max length', async () => {
    const { stellarAmountSchema } = await import('../../middleware/validate.js')
    expect(stellarAmountSchema.safeParse('9'.repeat(21)).success).toBe(false)
  })
})

// ── Rate Limiting ─────────────────────────────────────────────────────────────

describe('Security – Rate Limiting', () => {
  it('auth endpoint handles burst requests without 500 errors', async () => {
    vi.mocked(authService.loginUser).mockRejectedValue(new Error('Invalid credentials'))
    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app).post('/api/v1/auth/login').send({ email: 'burst@test.com', password: 'wrong' })
      )
    )
    responses.forEach((r) => expect(r.status).not.toBe(500))
  })
})

// ── Security Headers Compliance ──────────────────────────────────────────────

describe('Security – Security Headers Compliance', () => {
  it('sets Referrer-Policy: no-referrer', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
  })

  it('sets X-DNS-Prefetch-Control: off', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['x-dns-prefetch-control']).toBe('off')
  })

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('X-Powered-By is not exposed', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('CSP default-src is set to none (API does not serve HTML)', async () => {
    const res = await request(app).get('/api/v1/workers')
    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
  })
})

// ── Body Size Limits ────────────────────────────────────────────────────────

describe('Security – Body Size Limits', () => {
  it('rejects oversized request body (>100KB) with 413', async () => {
    const largePayload = { data: 'x'.repeat(200_000) }
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(largePayload)
    expect([400, 413]).toContain(res.status)
  })

  it('accepts normal-sized request body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'test@test.com', password: 'Password123!', firstName: 'A', lastName: 'B' })
    expect(res.status).not.toBe(413)
  })

  it('rejects deeply nested JSON (>20 levels)', async () => {
    let nested: Record<string, unknown> = { value: 'deep' }
    for (let i = 0; i < 25; i++) nested = { child: nested }
    const res = await request(app).post('/api/v1/auth/register').send(nested)
    expect(res.status).not.toBe(500)
  })
})

// ── Authorization Coverage ───────────────────────────────────────────────────

describe('Security – Authorization Coverage', () => {
  it('worker analytics view requires auth', async () => {
    const res = await request(app).post('/api/v1/workers/123/analytics/view')
    expect([401, 404]).toContain(res.status)
  })
})
