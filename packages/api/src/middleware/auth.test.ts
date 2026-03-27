import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { authenticate, authorize } from './auth.js'
import type { Request, Response, NextFunction } from 'express'

// Mock jsonwebtoken
vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}))

// Mock env config
vi.mock('../config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-secret',
  },
}))

const mockJwt = jwt as any

// Helper to create mock request
function createMockRequest(overrides = {}): Partial<Request> {
  return {
    headers: {},
    user: undefined,
    ...overrides,
  }
}

// Helper to create mock response
function createMockResponse(): Partial<Response> {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res
}

// Helper to create mock next function
function createMockNext(): NextFunction {
  return vi.fn()
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── authenticate middleware tests ────────────────────────────────────────────

describe('authenticate middleware', () => {
  it('calls next when valid token is provided', () => {
    const token = 'valid-token'
    const payload = { id: 'user-1', role: 'user' }
    mockJwt.verify.mockReturnValue(payload)

    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    authenticate(req, res, next)

    expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret')
    expect(req.user).toEqual(payload)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 401 when token is missing', () => {
    const req = createMockRequest({
      headers: {},
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Unauthorized',
      code: 401,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when authorization header is missing', () => {
    const req = createMockRequest({
      headers: { authorization: undefined },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when authorization header is empty', () => {
    const req = createMockRequest({
      headers: { authorization: '' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token is invalid', () => {
    mockJwt.verify.mockImplementation(() => {
      throw new Error('Invalid token')
    })

    const req = createMockRequest({
      headers: { authorization: 'Bearer invalid-token' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Invalid token',
      code: 401,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when token is expired', () => {
    mockJwt.verify.mockImplementation(() => {
      const error = new Error('jwt expired')
      ;(error as any).name = 'TokenExpiredError'
      throw error
    })

    const req = createMockRequest({
      headers: { authorization: 'Bearer expired-token' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Invalid token',
      code: 401,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('extracts token from Bearer scheme correctly', () => {
    const token = 'my-token-123'
    const payload = { id: 'user-1', role: 'admin' }
    mockJwt.verify.mockReturnValue(payload)

    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    authenticate(req, res, next)

    expect(mockJwt.verify).toHaveBeenCalledWith(token, 'test-secret')
  })

  it('sets user on request object with correct payload', () => {
    const payload = { id: 'user-123', role: 'curator' }
    mockJwt.verify.mockReturnValue(payload)

    const req = createMockRequest({
      headers: { authorization: 'Bearer token' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    authenticate(req, res, next)

    expect(req.user).toEqual(payload)
    expect(req.user?.id).toBe('user-123')
    expect(req.user?.role).toBe('curator')
  })

  it('handles malformed authorization header gracefully', () => {
    const req = createMockRequest({
      headers: { authorization: 'InvalidFormat' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

// ── authorize middleware tests ───────────────────────────────────────────────

describe('authorize middleware', () => {
  it('calls next when user has correct role', () => {
    const req = createMockRequest({
      user: { id: 'user-1', role: 'admin' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin')
    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('calls next when user has one of multiple allowed roles', () => {
    const req = createMockRequest({
      user: { id: 'user-1', role: 'curator' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin', 'curator')
    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('returns 403 when user has wrong role', () => {
    const req = createMockRequest({
      user: { id: 'user-1', role: 'user' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin')
    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Forbidden',
      code: 403,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when user is not on request', () => {
    const req = createMockRequest({
      user: undefined,
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin')
    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Forbidden',
      code: 403,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when user object is null', () => {
    const req = createMockRequest({
      user: null,
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin')
    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('supports multiple roles in authorization', () => {
    const req = createMockRequest({
      user: { id: 'user-1', role: 'moderator' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin', 'moderator', 'curator')
    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('is case-sensitive for role matching', () => {
    const req = createMockRequest({
      user: { id: 'user-1', role: 'Admin' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin')
    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns correct error response structure', () => {
    const req = createMockRequest({
      user: { id: 'user-1', role: 'user' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin')
    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    const jsonCall = res.json.mock.calls[0][0]
    expect(jsonCall).toHaveProperty('status', 'error')
    expect(jsonCall).toHaveProperty('message', 'Forbidden')
    expect(jsonCall).toHaveProperty('code', 403)
  })

  it('handles single role authorization', () => {
    const req = createMockRequest({
      user: { id: 'user-1', role: 'admin' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin')
    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('handles many roles authorization', () => {
    const req = createMockRequest({
      user: { id: 'user-1', role: 'curator' },
    }) as Request
    const res = createMockResponse() as Response
    const next = createMockNext()

    const middleware = authorize('admin', 'curator', 'moderator', 'user', 'guest')
    middleware(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})

// ── Integration tests ────────────────────────────────────────────────────────

describe('authenticate and authorize together', () => {
  it('allows authenticated admin user through both middlewares', () => {
    const token = 'valid-token'
    const payload = { id: 'user-1', role: 'admin' }
    mockJwt.verify.mockReturnValue(payload)

    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    }) as Request
    const res = createMockResponse() as Response
    const next1 = createMockNext()

    // First authenticate
    authenticate(req, res, next1)
    expect(next1).toHaveBeenCalled()

    // Then authorize
    const next2 = createMockNext()
    const authorizeMiddleware = authorize('admin')
    authorizeMiddleware(req, res, next2)
    expect(next2).toHaveBeenCalled()
  })

  it('blocks unauthenticated user at authenticate step', () => {
    const req = createMockRequest({
      headers: {},
    }) as Request
    const res = createMockResponse() as Response
    const next1 = createMockNext()

    // First authenticate
    authenticate(req, res, next1)
    expect(next1).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)

    // Authorize should not be reached
    const next2 = createMockNext()
    const authorizeMiddleware = authorize('admin')
    authorizeMiddleware(req, res, next2)
    expect(next2).not.toHaveBeenCalled()
  })

  it('blocks authenticated user with wrong role at authorize step', () => {
    const token = 'valid-token'
    const payload = { id: 'user-1', role: 'user' }
    mockJwt.verify.mockReturnValue(payload)

    const req = createMockRequest({
      headers: { authorization: `Bearer ${token}` },
    }) as Request
    const res = createMockResponse() as Response
    const next1 = createMockNext()

    // First authenticate
    authenticate(req, res, next1)
    expect(next1).toHaveBeenCalled()

    // Then authorize
    const next2 = createMockNext()
    const authorizeMiddleware = authorize('admin')
    authorizeMiddleware(req, res, next2)
    expect(next2).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })
})
