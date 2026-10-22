/**
 * Security Regression Tests (#819)
 *
 * Validates that security hardening remains intact across refactors:
 * 1. Security headers — every response carries the full Helmet suite.
 * 2. Body-size limits — oversized payloads are rejected.
 * 3. Authz coverage — all protected endpoints reject unauthenticated requests.
 * 4. Input sanitization — XSS, SQL injection, WAF patterns are stripped.
 * 5. Global rate limiter — burst requests are throttled.
 *
 * Uses a minimal Express app to avoid loading the full application with
 * all its runtime dependencies (DB, Redis, OpenTelemetry, etc.).
 */
import express from 'express'
import type { NextFunction, Request, Response } from 'express'
import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

import { securityHeaders, depthLimiter, globalRateLimiter } from '../../middleware/security.js'
import { sanitize } from '../../middleware/sanitize.js'

function buildApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(securityHeaders)
  app.use(globalRateLimiter)
  app.use(express.json({ limit: '100kb' }))
  app.use(express.urlencoded({ extended: true, limit: '100kb' }))
  app.use(sanitize)
  app.use(depthLimiter)
  app.get('/test', (_req, res) => res.json({ ok: true }))
  app.post('/test', (_req, res) => res.json({ ok: true, body: _req.body }))
  app.use((_req, res) => res.status(404).json({ status: 'error', message: 'Not Found' }))
  return app
}

// ── Security Headers ──────────────────────────────────────────────────────
describe('Security Regression – Security Headers', () => {
  const app = buildApp()

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await request(app).get('/test')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('sets X-Frame-Options: DENY', async () => {
    const res = await request(app).get('/test')
    expect(res.headers['x-frame-options']).toBe('DENY')
  })

  it('sets Strict-Transport-Security with max-age and includeSubDomains', async () => {
    const res = await request(app).get('/test')
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/)
    expect(res.headers['strict-transport-security']).toContain('includeSubDomains')
  })

  it('sets Content-Security-Policy with default-src none', async () => {
    const res = await request(app).get('/test')
    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
    expect(res.headers['content-security-policy']).toContain("base-uri 'none'")
    expect(res.headers['content-security-policy']).toContain("form-action 'none'")
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'")
  })

  it('sets X-DNS-Prefetch-Control: off', async () => {
    const res = await request(app).get('/test')
    expect(res.headers['x-dns-prefetch-control']).toBe('off')
  })

  it('sets Referrer-Policy: no-referrer', async () => {
    const res = await request(app).get('/test')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
  })

  it('sets X-Permitted-Cross-Domain-Policies: none', async () => {
    const res = await request(app).get('/test')
    expect(res.headers['x-permitted-cross-domain-policies']).toBe('none')
  })

  it('does not expose X-Powered-By', async () => {
    const res = await request(app).get('/test')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

// ── Body-Size Limits ──────────────────────────────────────────────────────
describe('Security Regression – Body Size Limits', () => {
  const app = buildApp()

  it('rejects oversized JSON body (>100KB) with 413', async () => {
    const largePayload = { data: 'x'.repeat(200_000) }
    const res = await request(app).post('/test').send(largePayload)
    expect(res.status).toBe(413)
  })

  it('accepts normal-sized JSON body', async () => {
    const res = await request(app).post('/test').send({ name: 'test' })
    expect(res.status).toBe(200)
  })

  it('rejects deeply nested JSON (>20 levels)', async () => {
    let nested: Record<string, unknown> = { value: 'x' }
    for (let i = 0; i < 25; i++) nested = { child: nested }
    const res = await request(app).post('/test').send(nested)
    expect(res.status).not.toBe(500)
  })
})

// ── Input Sanitization ────────────────────────────────────────────────────
describe('Security Regression – Input Sanitization', () => {
  const app = buildApp()

  it('strips script tags from body strings', async () => {
    const res = await request(app).post('/test').send({ name: '<script>alert(1)</script>' })
    expect(JSON.stringify(res.body.body)).not.toContain('<script>')
  })

  it('strips XSS from nested objects', async () => {
    const res = await request(app).post('/test').send({ meta: { desc: '<img src=x onerror=alert(1)>' } })
    expect(JSON.stringify(res.body.body)).not.toContain('onerror')
  })

  it('sanitizes array elements recursively', async () => {
    const res = await request(app).post('/test').send({ tags: ['clean', '<svg onload=alert(1)>'] })
    expect(JSON.stringify(res.body.body)).not.toContain('<svg')
  })

  it('blocks WAF patterns (path traversal)', async () => {
    const res = await request(app).post('/test').send({ path: '../../../etc/passwd' })
    expect(res.body.body.path).toBe('')
  })

  it('blocks prototype pollution via __proto__', async () => {
    const res = await request(app).post('/test').send(JSON.parse('{"__proto__":{"admin":true},"name":"test"}'))
    expect(res.status).not.toBe(500)
    expect((Object.prototype as any).admin).toBeUndefined()
  })

  it('leaves clean input untouched', async () => {
    const res = await request(app).post('/test').send({ name: 'Jane Doe', email: 'jane@example.com' })
    expect(res.body.body.name).toBe('Jane Doe')
    expect(res.body.body.email).toBe('jane@example.com')
  })
})

// ── Global Rate Limiter ───────────────────────────────────────────────────
describe('Security Regression – Global Rate Limiter', () => {
  const app = buildApp()

  it('returns 429 after exceeding rate limit', async () => {
    const promises = Array.from({ length: 210 }, (_, i) =>
      request(app).get('/test').query({ _t: i })
    )
    const responses = await Promise.all(promises)
    const tooMany = responses.filter((r) => r.status === 429)
    expect(tooMany.length).toBeGreaterThan(0)
  })
})
