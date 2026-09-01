import { describe, it, expect, vi, beforeEach } from 'vitest'
import { authenticate, authorize, revokeToken, _getRevokedJtis } from './auth.js'
import type { Request, Response, NextFunction } from 'express'

// ─── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../utils/tokenValidator.js', () => ({
  verifyToken: vi.fn(),
}))

vi.mock('../utils/roleChecker.js', () => ({
  hasRole: vi.fn(),
}))

import { verifyToken } from '../utils/tokenValidator.js'
import { hasRole } from '../utils/roleChecker.js'

const mockVerifyToken = vi.mocked(verifyToken)
const mockHasRole = vi.mocked(hasRole)

// ─── Helpers ────────────────────────────────────────────────────────────────────

function makeRes() {
  const res: any = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as Response
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    user: undefined,
    ...overrides,
  } as Request
}

const next = vi.fn() as unknown as NextFunction

beforeEach(() => {
  vi.resetAllMocks()
  // Clear the revoked JTI set between tests
  _getRevokedJtis().clear()
})

// ── authenticate: Missing Token ────────────────────────────────────────────────

describe('authenticate — missing token', () => {
  it('returns 401 when no Authorization header is present', () => {
    const req = makeReq()
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Unauthorized',
      code: 401,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header is undefined', () => {
    const req = makeReq({ headers: { authorization: undefined } })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Unauthorized',
      code: 401,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header is empty string', () => {
    const req = makeReq({ headers: { authorization: '' } })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header lacks Bearer scheme', () => {
    const req = makeReq({ headers: { authorization: 'Basic abc123' } })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header is "Token" scheme', () => {
    const req = makeReq({ headers: { authorization: 'Token some-value' } })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header is "Digest" scheme', () => {
    const req = makeReq({ headers: { authorization: 'Digest username="user"' } })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when Authorization header has Bearer but no token', () => {
    const req = makeReq({ headers: { authorization: 'Bearer ' } })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

// ── authenticate: Malformed Token ──────────────────────────────────────────────

describe('authenticate — malformed token', () => {
  it('returns 401 for a token that does not match JWT structure', () => {
    const req = makeReq({ headers: { authorization: 'Bearer not-a-jwt' } })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Invalid token',
      code: 401,
    })
    expect(next).not.toHaveBeenCalled()
    expect(mockVerifyToken).not.toHaveBeenCalled()
  })

  it('returns 401 for a token with only two segments', () => {
    const req = makeReq({ headers: { authorization: 'Bearer header.payload' } })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockVerifyToken).not.toHaveBeenCalled()
  })

  it('returns 401 for a token with four segments', () => {
    const req = makeReq({
      headers: { authorization: 'Bearer aaa.bbb.ccc.ddd' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockVerifyToken).not.toHaveBeenCalled()
  })

  it('returns 401 for a token with invalid base64 characters', () => {
    const req = makeReq({
      headers: { authorization: 'Bearer spaces in token!!' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockVerifyToken).not.toHaveBeenCalled()
  })

  it('returns 401 for a token exceeding 2048 characters', () => {
    const longToken = 'a'.repeat(2049)
    const req = makeReq({
      headers: { authorization: `Bearer ${longToken}` },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(mockVerifyToken).not.toHaveBeenCalled()
  })

  it('returns 401 when verifyToken throws for an invalid token', () => {
    mockVerifyToken.mockImplementation(() => {
      throw new Error('invalid signature')
    })

    const req = makeReq({
      headers: { authorization: 'Bearer aaa.bbb.ccc' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Invalid token',
      code: 401,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when verifyToken throws a JsonWebTokenError', () => {
    const error = new Error('jwt malformed')
    error.name = 'JsonWebTokenError'
    mockVerifyToken.mockImplementation(() => {
      throw error
    })

    const req = makeReq({
      headers: { authorization: 'Bearer aaa.bbb.ccc' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 401 when verifyToken throws NotBeforeError', () => {
    const error = new Error('jwt not active')
    error.name = 'NotBeforeError'
    mockVerifyToken.mockImplementation(() => {
      throw error
    })

    const req = makeReq({
      headers: { authorization: 'Bearer aaa.bbb.ccc' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})

// ── authenticate: Expired Token ────────────────────────────────────────────────

describe('authenticate — expired token', () => {
  it('returns 401 when token is expired', () => {
    const error = new Error('jwt expired')
    error.name = 'TokenExpiredError'
    mockVerifyToken.mockImplementation(() => {
      throw error
    })

    const req = makeReq({
      headers: { authorization: 'Bearer expired.jwt.token' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Invalid token',
      code: 401,
    })
    expect(next).not.toHaveBeenCalled()
  })
})

// ── authenticate: Revoked Token ────────────────────────────────────────────────

describe('authenticate — revoked token', () => {
  it('returns 401 when token JTI has been revoked', () => {
    mockVerifyToken.mockReturnValue({ id: 'user-1', role: 'user', jti: 'revoked-jti' } as any)

    revokeToken('revoked-jti')

    const req = makeReq({
      headers: { authorization: 'Bearer valid.jwt.token' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Token has been revoked',
      code: 401,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('allows token with a JTI that has not been revoked', () => {
    mockVerifyToken.mockReturnValue({ id: 'user-1', role: 'user', jti: 'valid-jti' } as any)

    const req = makeReq({
      headers: { authorization: 'Bearer valid.jwt.token' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(req.user).toEqual({ id: 'user-1', role: 'user', jti: 'valid-jti' })
  })

  it('allows token without a JTI even if other JTIs are revoked', () => {
    revokeToken('some-other-jti')
    mockVerifyToken.mockReturnValue({ id: 'user-1', role: 'user' })

    const req = makeReq({
      headers: { authorization: 'Bearer valid.jwt.token' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(next).toHaveBeenCalled()
  })
})

// ── authenticate: Valid Token (Control Case) ──────────────────────────────────

describe('authenticate — valid token', () => {
  it('calls next and sets req.user for a valid token', () => {
    const payload = { id: 'user-1', role: 'curator' }
    mockVerifyToken.mockReturnValue(payload)

    const req = makeReq({
      headers: { authorization: 'Bearer valid.jwt.token' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(mockVerifyToken).toHaveBeenCalledWith('valid.jwt.token')
    expect(req.user).toEqual(payload)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('extracts token correctly after "Bearer " prefix', () => {
    const payload = { id: 'user-1', role: 'admin' }
    mockVerifyToken.mockReturnValue(payload)

    const req = makeReq({
      headers: { authorization: 'Bearer my.jwt.token' },
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(mockVerifyToken).toHaveBeenCalledWith('my.jwt.token')
  })

  it('sets req.user with id and role from payload', () => {
    const payload = { id: 'user-123', role: 'admin' }
    mockVerifyToken.mockReturnValue(payload)

    const req = makeReq({
      headers: { authorization: 'Bearer aaa.bbb.ccc' },
    }) as any
    const res = makeRes()

    authenticate(req, res, next)

    expect(req.user).toBeDefined()
    expect(req.user?.id).toBe('user-123')
    expect(req.user?.role).toBe('admin')
  })
})

// ── authorize: Insufficient Permissions ────────────────────────────────────────

describe('authorize — insufficient permissions', () => {
  it('returns 403 when req.user is not set', () => {
    const req = makeReq() as any
    const res = makeRes()

    mockHasRole.mockReturnValue(false)

    authorize('admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Forbidden',
      code: 403,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when user role is not in allowed list', () => {
    const req = makeReq({ user: { id: 'u1', role: 'user' } }) as any
    const res = makeRes()

    mockHasRole.mockReturnValue(false)

    authorize('admin', 'curator')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({
      status: 'error',
      message: 'Forbidden',
      code: 403,
    })
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 when user object is null', () => {
    const req = makeReq({ user: null }) as any
    const res = makeRes()

    mockHasRole.mockReturnValue(false)

    authorize('admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 for a "user" role trying to access "admin" route', () => {
    const req = makeReq({ user: { id: 'u1', role: 'user' } }) as any
    const res = makeRes()

    mockHasRole.mockReturnValue(false)

    authorize('admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns 403 for a "curator" role trying to access "admin" route', () => {
    const req = makeReq({ user: { id: 'u1', role: 'curator' } }) as any
    const res = makeRes()

    mockHasRole.mockReturnValue(false)

    authorize('admin')(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('returns correct error response structure for forbidden', () => {
    const req = makeReq({ user: { id: 'u1', role: 'user' } }) as any
    const res = makeRes()

    mockHasRole.mockReturnValue(false)

    authorize('admin')(req, res, next)

    const jsonCall = (res.json as any).mock.calls[0][0]
    expect(jsonCall).toHaveProperty('status', 'error')
    expect(jsonCall).toHaveProperty('message', 'Forbidden')
    expect(jsonCall).toHaveProperty('code', 403)
  })
})

// ── authorize: Valid Permission (Control Case) ────────────────────────────────

describe('authorize — valid permissions', () => {
  it('calls next when user role is allowed', () => {
    const req = makeReq({ user: { id: 'u1', role: 'curator' } }) as any
    const res = makeRes()

    mockHasRole.mockReturnValue(true)

    authorize('admin', 'curator')(req, res, next)

    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
  })

  it('calls next when user has admin role', () => {
    const req = makeReq({ user: { id: 'u1', role: 'admin' } }) as any
    const res = makeRes()

    mockHasRole.mockReturnValue(true)

    authorize('admin')(req, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('passes the correct roles array to hasRole', () => {
    const req = makeReq({ user: { id: 'u1', role: 'curator' } }) as any
    const res = makeRes()

    mockHasRole.mockReturnValue(true)

    authorize('admin', 'curator', 'moderator')(req, res, next)

    expect(mockHasRole).toHaveBeenCalledWith(
      { id: 'u1', role: 'curator' },
      ['admin', 'curator', 'moderator'],
    )
  })
})

// ── authenticate + authorize: Combined Flow ────────────────────────────────────

describe('authenticate and authorize — combined flow', () => {
  it('allows authenticated admin through both middlewares', () => {
    const payload = { id: 'user-1', role: 'admin' }
    mockVerifyToken.mockReturnValue(payload)
    mockHasRole.mockReturnValue(true)

    const req = makeReq({
      headers: { authorization: 'Bearer valid.jwt.token' },
    })
    const res = makeRes()
    const next1 = vi.fn() as unknown as NextFunction

    authenticate(req, res, next1)
    expect(next1).toHaveBeenCalled()

    const next2 = vi.fn() as unknown as NextFunction
    authorize('admin')(req, res, next2)
    expect(next2).toHaveBeenCalled()
  })

  it('blocks unauthenticated request at authenticate step', () => {
    const req = makeReq() as any
    const res = makeRes()
    const next1 = vi.fn() as unknown as NextFunction

    authenticate(req, res, next1)
    expect(next1).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)

    // Authorize should see no user and also block
    const next2 = vi.fn() as unknown as NextFunction
    mockHasRole.mockReturnValue(false)
    authorize('admin')(req, res, next2)
    expect(next2).not.toHaveBeenCalled()
  })

  it('blocks authenticated user with wrong role at authorize step', () => {
    const payload = { id: 'user-1', role: 'user' }
    mockVerifyToken.mockReturnValue(payload)
    mockHasRole.mockReturnValue(false)

    const req = makeReq({
      headers: { authorization: 'Bearer valid.jwt.token' },
    })
    const res = makeRes()
    const next1 = vi.fn() as unknown as NextFunction

    authenticate(req, res, next1)
    expect(next1).toHaveBeenCalled()
    expect(req.user).toEqual(payload)

    const next2 = vi.fn() as unknown as NextFunction
    authorize('admin')(req, res, next2)
    expect(next2).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('blocks expired token before reaching authorize', () => {
    const error = new Error('jwt expired')
    error.name = 'TokenExpiredError'
    mockVerifyToken.mockImplementation(() => { throw error })

    const req = makeReq({
      headers: { authorization: 'Bearer expired.jwt.token' },
    })
    const res = makeRes()
    const next1 = vi.fn() as unknown as NextFunction

    authenticate(req, res, next1)
    expect(next1).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(401)
  })
})

// ── requireAuth alias ──────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('is an alias for authenticate', async () => {
    const { requireAuth } = await import('./auth.js')
    expect(requireAuth).toBe(authenticate)
  })
})
