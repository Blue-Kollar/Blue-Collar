/**
 * Shared test harness for API unit tests (#1468).
 *
 * Consolidates the `makeRes` / `makeReq` / `makeNext` boilerplate that was
 * previously copy-pasted into every controller and middleware test file.
 * Backed by the shared implementations in `@bluecollar/test-utils/express`
 * so there is one canonical version across the monorepo.
 *
 * Usage:
 *   import { makeRes, makeReq, makeNext } from '../helpers/testHarness.js'
 *
 *   const req = makeReq({ body: { email: 'a@b.com' }, user: { id: '1', role: 'user' } })
 *   const res = makeRes()
 *   const next = makeNext()
 *   await myController(req, res, next)
 *   expect(res.status).toHaveBeenCalledWith(200)
 */

import {
  makeRequest,
  makeResponse,
  makeNext as _makeNext,
  makeJwt,
  makeExpiredJwt,
  type MockRequest,
  type MockResponse,
  type MockUser,
} from '@bluecollar/test-utils/express'

// ── Re-export under the short names used throughout __tests__ ─────────────────

/**
 * Create a mock Express Request.
 *
 * @example
 * const req = makeReq({ body: { email: 'a@b.com' } })
 * const req = makeReq({ params: { id: 'worker-1' }, user: { id: 'u-1', role: 'curator' } })
 */
export function makeReq(overrides: Partial<MockRequest> = {}): MockRequest {
  return makeRequest(overrides)
}

/**
 * Create a mock Express Response with a chainable `status().json()` stub.
 *
 * @example
 * const res = makeRes()
 * expect(res.status).toHaveBeenCalledWith(200)
 * expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }))
 */
export function makeRes(): MockResponse {
  return makeResponse()
}

/**
 * Create a mock `next` function (Express NextFunction).
 *
 * @example
 * const next = makeNext()
 * expect(next).not.toHaveBeenCalled() // no error was forwarded
 */
export const makeNext = _makeNext

// ── JWT helpers re-exported for convenience ───────────────────────────────────

export { makeJwt, makeExpiredJwt }
export type { MockRequest, MockResponse, MockUser }
