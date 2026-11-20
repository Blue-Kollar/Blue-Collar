/**
 * Security headers and origin restriction on the shared middleware (#1827).
 */

import { describe, it, expect } from 'vitest'
import express from 'express'
import request from 'supertest'
import { securityHeaders, strictCors } from './security'

function buildApp() {
  const app = express()
  app.use(securityHeaders)
  app.use(strictCors)
  app.get('/ping', (_req, res) => res.json({ ok: true }))
  return app
}

describe('security headers (#1827)', () => {
  it('sets helmet defaults on responses', async () => {
    const res = await request(buildApp()).get('/ping')

    expect(res.status).toBe(200)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['x-frame-options']).toBe('DENY')
    expect(res.headers['referrer-policy']).toBe('no-referrer')
    expect(res.headers['strict-transport-security']).toContain('max-age=15552000')
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('applies the restrictive content security policy', async () => {
    const res = await request(buildApp()).get('/ping')

    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
    expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'")
  })
})
