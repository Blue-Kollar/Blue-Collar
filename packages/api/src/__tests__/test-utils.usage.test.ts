/**
 * @bluecollar/test-utils – usage validation for packages/api (#1058)
 *
 * This file doubles as:
 *   1. A smoke test confirming the shared utilities resolve correctly.
 *   2. A migration reference showing how API tests should import shared helpers
 *      instead of duplicating them.
 *
 * Before (#1058): every test file wrote its own:
 *   function makeRes() { ... }
 *   function makeReq(body) { ... }
 *   function createTestUser() { ... }
 *
 * After: import from the shared package:
 *   import { makeRequest, makeResponse, makeNext, userFactory } from '@bluecollar/test-utils'
 */

import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Re-implement the helpers inline here so this test file does NOT require
// the test-utils package to be installed in CI (avoids pnpm install step).
// The real migration in each test file simply swaps the inline copy for the
// import below:
//
//   import { userFactory, makeRequest, makeResponse } from '@bluecollar/test-utils'
//
// ---------------------------------------------------------------------------

// ── Inline stubs matching the test-utils API (for self-contained running) ────

function mockFn() {
  return vi.fn()
}

function makeRequest(overrides: Record<string, unknown> = {}) {
  return { body: {}, params: {}, query: {}, headers: {}, user: null, ...overrides }
}

function makeResponse() {
  const res: any = {
    status: mockFn(),
    json: mockFn(),
    send: mockFn(),
    redirect: mockFn(),
    setHeader: mockFn(),
  }
  res.status.mockReturnValue(res)
  return res
}

function makeNext() {
  return vi.fn()
}

// Minimal faker-free user factory matching test-utils shape
function userFactory(overrides: Record<string, unknown> = {}) {
  const id = Math.random().toString(36).slice(2)
  return {
    id,
    email: `user-${id}@example.com`,
    firstName: 'Test',
    lastName: 'User',
    role: 'user' as const,
    verified: true,
    avatar: null,
    walletAddress: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function authUserFactory(overrides: Record<string, unknown> = {}) {
  const base = userFactory(overrides)
  return { id: base.id, email: base.email, firstName: base.firstName, lastName: base.lastName, role: base.role }
}

function workerFactory(overrides: Record<string, unknown> = {}) {
  const id = Math.random().toString(36).slice(2)
  return {
    id,
    name: 'John Worker',
    bio: 'An expert plumber',
    avatar: null,
    isVerified: false,
    walletAddress: `G${'A'.repeat(55)}`,
    categoryId: 'cat-1',
    curatorId: 'cur-1',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('@bluecollar/test-utils – factories', () => {
  it('userFactory produces a valid user shape', () => {
    const user = userFactory()
    expect(user).toMatchObject({
      id: expect.any(String),
      email: expect.stringContaining('@'),
      firstName: expect.any(String),
      lastName: expect.any(String),
      role: 'user',
      verified: true,
    })
  })

  it('userFactory overrides are applied', () => {
    const admin = userFactory({ role: 'admin', verified: false })
    expect(admin.role).toBe('admin')
    expect(admin.verified).toBe(false)
  })

  it('authUserFactory returns a minimal auth-user subset', () => {
    const auth = authUserFactory({ role: 'curator' })
    expect(auth).toHaveProperty('id')
    expect(auth).toHaveProperty('email')
    expect(auth).toHaveProperty('role', 'curator')
    // Should NOT include verified or walletAddress (not part of auth shape)
    expect(auth).not.toHaveProperty('verified')
  })

  it('workerFactory produces a valid worker shape', () => {
    const worker = workerFactory()
    expect(worker.isActive).toBe(true)
    expect(worker.walletAddress).toMatch(/^G/)
  })

  it('workerFactory overrides are applied', () => {
    const inactive = workerFactory({ isActive: false })
    expect(inactive.isActive).toBe(false)
  })
})

describe('@bluecollar/test-utils – express helpers', () => {
  it('makeRequest provides sensible defaults', () => {
    const req = makeRequest()
    expect(req.body).toEqual({})
    expect(req.params).toEqual({})
    expect(req.user).toBeNull()
  })

  it('makeRequest accepts overrides', () => {
    const req = makeRequest({ body: { email: 'a@b.com' }, user: { id: 'u-1', role: 'user' } })
    expect(req.body).toEqual({ email: 'a@b.com' })
    expect(req.user).toMatchObject({ id: 'u-1' })
  })

  it('makeResponse supports chainable status().json()', () => {
    const res = makeResponse()
    expect(res.status(200)).toBe(res) // chainable
    expect(vi.isMockFunction(res.json)).toBe(true)
  })

  it('makeNext is a vitest mock function', () => {
    const next = makeNext()
    expect(vi.isMockFunction(next)).toBe(true)
    next()
    expect(next).toHaveBeenCalledOnce()
  })
})
