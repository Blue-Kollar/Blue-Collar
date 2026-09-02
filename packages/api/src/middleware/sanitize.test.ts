import { describe, expect, it, vi } from 'vitest'

import { sanitize } from './sanitize.js'

function mockReqRes(body: Record<string, any> = {}, query: Record<string, any> = {}) {
  const req = { body, query } as any
  const res = {} as any
  return { req, res }
}

describe('sanitize middleware', () => {
  it('strips script tags from body strings', () => {
    const { req, res } = mockReqRes({ name: '<script>alert(1)</script>Joe' })
    sanitize(req, res, vi.fn())
    expect(req.body.name).not.toContain('<script>')
  })

  it('strips XSS from nested objects', () => {
    const { req, res } = mockReqRes({ address: { city: '<img src=x onerror=alert(1)>NYC' } })
    sanitize(req, res, vi.fn())
    expect(req.body.address.city).not.toContain('onerror')
  })

  it('sanitizes query params', () => {
    const { req, res } = mockReqRes({}, { q: '<script>evil()</script>' })
    sanitize(req, res, vi.fn())
    expect(req.query.q).not.toContain('<script>')
  })

  it('sanitizes arrays recursively', () => {
    const { req, res } = mockReqRes({ tags: ['clean', '<img src=x onerror=alert(1)>'] })
    sanitize(req, res, vi.fn())
    expect(req.body.tags[1]).not.toContain('onerror')
  })

  it('leaves clean input untouched', () => {
    const { req, res } = mockReqRes({ name: 'Jane Doe' })
    sanitize(req, res, vi.fn())
    expect(req.body.name).toBe('Jane Doe')
  })
})
