// Closes #1856

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';

// Mock tokenValidator before importing the middleware so the middleware picks
// up the mocked version at module-load time.
vi.mock('../../utils/tokenValidator.js', () => ({
  verifyToken: vi.fn(),
}));

// Provide a stable env config so the middleware (and tokenValidator) don't
// blow up trying to read real environment variables.
vi.mock('../../config/env.js', () => ({
  env: { JWT_SECRET: 'test-secret' },
}));

import {
  authenticate,
  authorize,
  requireAuth,
  revokeToken,
  _getRevokedJtis,
} from '@/middleware/auth.js';
import { verifyToken } from '@/utils/tokenValidator.js';
import type { Request, Response, NextFunction } from 'express';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type DeepPartial<T> = { [K in keyof T]?: T[K] };

function makeReq(overrides: DeepPartial<Request> = {}): Request {
  return {
    headers: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const res = {
    _status: 0,
    _body: undefined as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._body = body;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _body: unknown };
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// A syntactically valid JWT-shaped token (three base64url segments).
const VALID_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJpZCI6InVzZXItMSIsInJvbGUiOiJ3b3JrZXIifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// ─── Test isolation ───────────────────────────────────────────────────────────

beforeEach(() => {
  _getRevokedJtis().clear();
  vi.clearAllMocks();
});

// ─── authenticate ─────────────────────────────────────────────────────────────

describe('authenticate', () => {
  describe('missing / malformed Authorization header', () => {
    it('responds 401 when no Authorization header is present', () => {
      const req = makeReq({ headers: {} });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toEqual({ status: 'error', message: 'Unauthorized', code: 401 });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when Authorization header lacks "Bearer " prefix', () => {
      const req = makeReq({ headers: { authorization: 'Token somevalue' } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ status: 'error', message: 'Unauthorized' });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when Authorization header is exactly "Bearer " with no token', () => {
      // Empty string after "Bearer " fails the JWT pattern check.
      const req = makeReq({ headers: { authorization: 'Bearer ' } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when token exceeds 2048 characters', () => {
      const longToken = 'a'.repeat(2049);
      const req = makeReq({ headers: { authorization: `Bearer ${longToken}` } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ message: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when token does not match the JWT 3-segment pattern', () => {
      // Contains a "!" which is not in the base64url alphabet.
      const req = makeReq({ headers: { authorization: 'Bearer not.a.valid!token' } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ message: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when token has only two segments (missing signature)', () => {
      const req = makeReq({ headers: { authorization: 'Bearer header.payload' } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('valid token', () => {
    it('attaches req.user and calls next() when verifyToken returns a valid payload', () => {
      vi.mocked(verifyToken).mockReturnValueOnce({ id: 'user-1', role: 'worker' });

      const req = makeReq({ headers: { authorization: `Bearer ${VALID_TOKEN}` } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect((req as Request & { user: unknown }).user).toEqual({ id: 'user-1', role: 'worker' });
      // No response should have been sent
      expect(res._status).toBe(0);
    });

    it('passes through when payload contains a jti that is not revoked', () => {
      vi.mocked(verifyToken).mockReturnValueOnce({ id: 'user-2', role: 'admin', jti: 'fresh-jti' });

      const req = makeReq({ headers: { authorization: `Bearer ${VALID_TOKEN}` } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect((req as Request & { user: unknown }).user).toEqual({
        id: 'user-2',
        role: 'admin',
        jti: 'fresh-jti',
      });
    });
  });

  describe('expired / invalid token', () => {
    it('responds 401 when verifyToken throws JsonWebTokenError', () => {
      vi.mocked(verifyToken).mockImplementationOnce(() => {
        throw new JsonWebTokenError('invalid signature');
      });

      const req = makeReq({ headers: { authorization: `Bearer ${VALID_TOKEN}` } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ message: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when verifyToken throws TokenExpiredError', () => {
      vi.mocked(verifyToken).mockImplementationOnce(() => {
        throw new TokenExpiredError('jwt expired', new Date());
      });

      const req = makeReq({ headers: { authorization: `Bearer ${VALID_TOKEN}` } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ message: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 401 when verifyToken throws a generic Error', () => {
      vi.mocked(verifyToken).mockImplementationOnce(() => {
        throw new Error('unexpected error');
      });

      const req = makeReq({ headers: { authorization: `Bearer ${VALID_TOKEN}` } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ message: 'Invalid token' });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('JTI revocation', () => {
    it('responds 401 when the token jti has been revoked', () => {
      revokeToken('revoked-jti-1');
      vi.mocked(verifyToken).mockReturnValueOnce({
        id: 'user-3',
        role: 'worker',
        jti: 'revoked-jti-1',
      });

      const req = makeReq({ headers: { authorization: `Bearer ${VALID_TOKEN}` } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(res._status).toBe(401);
      expect(res._body).toMatchObject({ message: 'Token has been revoked' });
      expect(next).not.toHaveBeenCalled();
    });

    it('passes through when the token jti has not been revoked', () => {
      revokeToken('some-other-jti');
      vi.mocked(verifyToken).mockReturnValueOnce({
        id: 'user-4',
        role: 'curator',
        jti: 'different-jti',
      });

      const req = makeReq({ headers: { authorization: `Bearer ${VALID_TOKEN}` } });
      const res = makeRes();
      const next = makeNext();

      authenticate(req, res, next);

      expect(next).toHaveBeenCalledOnce();
      expect(res._status).toBe(0);
    });
  });
});

// ─── authorize ────────────────────────────────────────────────────────────────

describe('authorize', () => {
  it('calls next() when the user role matches the allowed role', () => {
    const req = makeReq({ user: { id: 'u1', role: 'admin' } } as DeepPartial<Request>);
    const res = makeRes();
    const next = makeNext();

    authorize('admin')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res._status).toBe(0);
  });

  it('responds 403 when the user role does not match', () => {
    const req = makeReq({ user: { id: 'u2', role: 'worker' } } as DeepPartial<Request>);
    const res = makeRes();
    const next = makeNext();

    authorize('admin')(req, res, next);

    expect(res._status).toBe(403);
    expect(res._body).toEqual({ status: 'error', message: 'Forbidden', code: 403 });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when req.user is undefined', () => {
    const req = makeReq({ headers: {} });
    const res = makeRes();
    const next = makeNext();

    authorize('admin')(req, res, next);

    expect(res._status).toBe(403);
    expect(res._body).toMatchObject({ message: 'Forbidden' });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 403 when req.user is null', () => {
    // Force null onto the user property to test the null guard in hasRole.
    const req = makeReq({
      user: null as unknown as { id: string; role: string },
    } as DeepPartial<Request>);
    const res = makeRes();
    const next = makeNext();

    authorize('curator')(req, res, next);

    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when the user has one of several allowed roles', () => {
    const req = makeReq({ user: { id: 'u3', role: 'curator' } } as DeepPartial<Request>);
    const res = makeRes();
    const next = makeNext();

    authorize('admin', 'curator', 'moderator')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('responds 403 when the user has none of several allowed roles', () => {
    const req = makeReq({ user: { id: 'u4', role: 'worker' } } as DeepPartial<Request>);
    const res = makeRes();
    const next = makeNext();

    authorize('admin', 'curator', 'moderator')(req, res, next);

    expect(res._status).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ─── requireAuth ──────────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('is the same function reference as authenticate', () => {
    expect(requireAuth).toBe(authenticate);
  });
});

// ─── revokeToken and _getRevokedJtis ─────────────────────────────────────────

describe('revokeToken and _getRevokedJtis', () => {
  it('adds a JTI to the revocation set', () => {
    revokeToken('jti-123');

    expect(_getRevokedJtis().has('jti-123')).toBe(true);
  });

  it('a token bearing that JTI is subsequently rejected with 401', () => {
    revokeToken('jti-123');
    vi.mocked(verifyToken).mockReturnValueOnce({ id: 'user-5', role: 'worker', jti: 'jti-123' });

    const req = makeReq({ headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const res = makeRes();
    const next = makeNext();

    authenticate(req, res, next);

    expect(res._status).toBe(401);
    expect(res._body).toMatchObject({ message: 'Token has been revoked' });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not affect tokens with a different JTI', () => {
    revokeToken('jti-123');
    vi.mocked(verifyToken).mockReturnValueOnce({ id: 'user-6', role: 'admin', jti: 'jti-456' });

    const req = makeReq({ headers: { authorization: `Bearer ${VALID_TOKEN}` } });
    const res = makeRes();
    const next = makeNext();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });

  it('the revocation set is empty after beforeEach clear', () => {
    // This test relies on beforeEach calling _getRevokedJtis().clear().
    // Any JTIs added by prior tests should be gone.
    expect(_getRevokedJtis().size).toBe(0);
  });
});
