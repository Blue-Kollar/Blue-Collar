/**
 * Express mock helpers for API unit tests.
 *
 * These replace the per-file `makeReq` / `makeRes` / `makeNext` functions
 * that are currently duplicated in virtually every controller test file.
 *
 * Usage:
 *   import { makeRequest, makeResponse, makeNext } from '@bluecollar/test-utils'
 */

// vi / jest compatibility: the consuming test file provides the `vi` global
// when running under Vitest, or `jest` when running under Jest.
// We expose thin wrappers that defer to whichever mock runtime is available.
function _mockFn(): (...args: unknown[]) => unknown {
  if (typeof vi !== 'undefined') return vi.fn()
  if (typeof jest !== 'undefined') return jest.fn()
  // Fallback no-op (shouldn't be reached in a test environment)
  return () => undefined
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MockRequest {
  body: Record<string, unknown>
  params: Record<string, string>
  query: Record<string, string | string[]>
  headers: Record<string, string>
  user: MockUser | null
  [key: string]: unknown
}

export interface MockUser {
  id: string
  role: 'user' | 'curator' | 'admin'
  email?: string
}

export interface MockResponse {
  status: ReturnType<typeof _mockFn>
  json: ReturnType<typeof _mockFn>
  send: ReturnType<typeof _mockFn>
  redirect: ReturnType<typeof _mockFn>
  setHeader: ReturnType<typeof _mockFn>
  [key: string]: unknown
}

// ── Factories ─────────────────────────────────────────────────────────────────

/**
 * Create a mock Express Request.
 *
 * @example
 * const req = makeRequest({ body: { email: 'a@b.com' }, user: { id: '1', role: 'user' } })
 */
export function makeRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    user: null,
    ...overrides,
  }
}

/**
 * Create a mock Express Response with chainable status().json() stubs.
 *
 * @example
 * const res = makeResponse()
 * controller(req, res)
 * expect(res.status).toHaveBeenCalledWith(200)
 * expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }))
 */
export function makeResponse(): MockResponse {
  const res: MockResponse = {
    status: _mockFn(),
    json: _mockFn(),
    send: _mockFn(),
    redirect: _mockFn(),
    setHeader: _mockFn(),
  }
  // Enable res.status(xxx).json(...) chaining
  ;(res.status as ReturnType<typeof _mockFn>).mockReturnValue(res)
  return res
}

/**
 * Create a mock `next` function (Express NextFunction).
 */
export function makeNext(): ReturnType<typeof _mockFn> {
  return _mockFn()
}

/**
 * JWT builder for tests — signs a minimal payload with the test secret.
 * Requires `jsonwebtoken` to be installed in the consuming package.
 *
 * @example
 * const token = makeJwt({ id: 'u-1', role: 'admin' })
 * req.headers.authorization = `Bearer ${token}`
 */
export function makeJwt(
  payload: Record<string, unknown> = {},
  secret = process.env.JWT_SECRET ?? 'test-secret',
  options: { expiresIn?: string } = { expiresIn: '1h' },
): string {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const jwt = require('jsonwebtoken')
  return jwt.sign(payload, secret, options)
}

/**
 * Build an expired JWT for testing token-rejection paths.
 */
export function makeExpiredJwt(
  payload: Record<string, unknown> = {},
  secret = process.env.JWT_SECRET ?? 'test-secret',
): string {
  return makeJwt(payload, secret, { expiresIn: '-1s' })
}
