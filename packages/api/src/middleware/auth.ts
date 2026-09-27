import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/tokenValidator.js'
import { hasRole } from '../utils/roleChecker.js'

// JWT structure: three base64url segments separated by dots
const JWT_PATTERN = /^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$/

// In-memory revoked JTI set (production should use Redis).
// Populated by logout to prevent token reuse after sign-out.
const revokedJtis = new Set<string>()

/** Add a JTI to the revocation list (called by the logout handler). */
export function revokeToken(jti: string): void {
  revokedJtis.add(jti)
}

/** Expose the revocation set for testing purposes only. */
export function _getRevokedJtis(): Set<string> {
  return revokedJtis
}

/**
 * Middleware: verify the Bearer JWT in the `Authorization` header.
 *
 * On success, attaches `{ id, role }` to `req.user` and calls `next()`.
 * On failure, responds with 401.
 *
 * Security hardening:
 * - Validates Bearer scheme explicitly (prevents type confusion attacks)
 * - Rejects tokens that don't match JWT structure before attempting verification
 * - Enforces maximum token length to prevent DoS via oversized inputs
 * - Checks JTI revocation list to block reuse of logged-out tokens
 *
 * @example
 * router.get('/protected', authenticate, handler)
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized', code: 401 })
  }

  const token = authHeader.slice(7)

  // Structural pre-validation: reject obviously malformed tokens early
  if (token.length > 2048 || !JWT_PATTERN.test(token)) {
    return res.status(401).json({ status: 'error', message: 'Invalid token', code: 401 })
  }

  try {
    const payload = verifyToken(token)

    // Block revoked tokens (post-logout reuse prevention)
    if (payload.jti && revokedJtis.has(payload.jti)) {
      return res.status(401).json({ status: 'error', message: 'Token has been revoked', code: 401 })
    }

    req.user = payload
    next()
  } catch {
    return res.status(401).json({ status: 'error', message: 'Invalid token', code: 401 })
  }
}

/**
 * Middleware factory: restrict access to users whose role is in `roles`.
 *
 * Must be used after `authenticate` so that `req.user` is populated.
 *
 * @param roles - One or more allowed role strings (e.g. `'curator'`, `'admin'`).
 * @returns Express middleware that responds with 403 if the user's role is not allowed.
 *
 * @example
 * router.post('/workers', authenticate, authorize('curator', 'admin'), createWorker)
 */
export function authorize(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hasRole(req.user, roles)) {
      return res.status(403).json({ status: 'error', message: 'Forbidden', code: 403 })
    }
    next()
  }
}

/** Alias for authenticate — used by routes that prefer this naming style. */
export const requireAuth = authenticate;
