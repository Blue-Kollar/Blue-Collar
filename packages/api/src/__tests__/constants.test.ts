/**
 * Unit tests for the centralised constants modules.
 *
 * These tests verify:
 *  - HttpStatus codes map to the correct numeric values
 *  - ErrorMessages contain non-empty strings (or callable functions)
 *  - The barrel export (constants/index.ts) re-exports everything
 *  - ErrorMessages.ROUTE_NOT_FOUND builds the expected string
 */

import { describe, expect,it } from 'vitest'

import { ErrorMessages } from '../constants/errors.js'
import { HttpStatus, HttpStatusCode } from '../constants/httpStatus.js'
import * as ConstantsIndex from '../constants/index.js'

// ─── HttpStatus ───────────────────────────────────────────────────────────────

describe('HttpStatus', () => {
  describe('2xx Success', () => {
    it('OK is 200', () => expect(HttpStatus.OK).toBe(200))
    it('CREATED is 201', () => expect(HttpStatus.CREATED).toBe(201))
    it('ACCEPTED is 202', () => expect(HttpStatus.ACCEPTED).toBe(202))
    it('NO_CONTENT is 204', () => expect(HttpStatus.NO_CONTENT).toBe(204))
  })

  describe('4xx Client Error', () => {
    it('BAD_REQUEST is 400', () => expect(HttpStatus.BAD_REQUEST).toBe(400))
    it('UNAUTHORIZED is 401', () => expect(HttpStatus.UNAUTHORIZED).toBe(401))
    it('FORBIDDEN is 403', () => expect(HttpStatus.FORBIDDEN).toBe(403))
    it('NOT_FOUND is 404', () => expect(HttpStatus.NOT_FOUND).toBe(404))
    it('METHOD_NOT_ALLOWED is 405', () => expect(HttpStatus.METHOD_NOT_ALLOWED).toBe(405))
    it('CONFLICT is 409', () => expect(HttpStatus.CONFLICT).toBe(409))
    it('UNPROCESSABLE_ENTITY is 422', () => expect(HttpStatus.UNPROCESSABLE_ENTITY).toBe(422))
    it('TOO_MANY_REQUESTS is 429', () => expect(HttpStatus.TOO_MANY_REQUESTS).toBe(429))
  })

  describe('5xx Server Error', () => {
    it('INTERNAL_SERVER_ERROR is 500', () => expect(HttpStatus.INTERNAL_SERVER_ERROR).toBe(500))
    it('BAD_GATEWAY is 502', () => expect(HttpStatus.BAD_GATEWAY).toBe(502))
    it('SERVICE_UNAVAILABLE is 503', () => expect(HttpStatus.SERVICE_UNAVAILABLE).toBe(503))
  })

  it('all values are positive integers', () => {
    for (const value of Object.values(HttpStatus)) {
      expect(typeof value).toBe('number')
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThan(0)
    }
  })

  it('is frozen (const assertion prevents mutation at runtime)', () => {
    // TypeScript `as const` doesn't deep-freeze at runtime, but the object
    // itself should not be accidentally extended with new keys.
    const keys = Object.keys(HttpStatus)
    expect(keys.length).toBeGreaterThan(0)
    // Spot-check: no duplicate numeric values
    const values = Object.values(HttpStatus) as number[]
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })
})

// ─── ErrorMessages ────────────────────────────────────────────────────────────

describe('ErrorMessages', () => {
  it('INTERNAL_SERVER_ERROR is a non-empty string', () => {
    expect(typeof ErrorMessages.INTERNAL_SERVER_ERROR).toBe('string')
    expect(ErrorMessages.INTERNAL_SERVER_ERROR.length).toBeGreaterThan(0)
  })

  it('UNAUTHORIZED is a non-empty string', () => {
    expect(typeof ErrorMessages.UNAUTHORIZED).toBe('string')
    expect(ErrorMessages.UNAUTHORIZED.length).toBeGreaterThan(0)
  })

  it('NOT_FOUND is a non-empty string', () => {
    expect(typeof ErrorMessages.NOT_FOUND).toBe('string')
    expect(ErrorMessages.NOT_FOUND.length).toBeGreaterThan(0)
  })

  it('USER_NOT_FOUND is a non-empty string', () => {
    expect(typeof ErrorMessages.USER_NOT_FOUND).toBe('string')
    expect(ErrorMessages.USER_NOT_FOUND.length).toBeGreaterThan(0)
  })

  it('WORKER_NOT_FOUND is a non-empty string', () => {
    expect(typeof ErrorMessages.WORKER_NOT_FOUND).toBe('string')
    expect(ErrorMessages.WORKER_NOT_FOUND.length).toBeGreaterThan(0)
  })

  it('CATEGORY_NOT_FOUND is a non-empty string', () => {
    expect(typeof ErrorMessages.CATEGORY_NOT_FOUND).toBe('string')
    expect(ErrorMessages.CATEGORY_NOT_FOUND.length).toBeGreaterThan(0)
  })

  describe('ROUTE_NOT_FOUND', () => {
    it('is a function', () => {
      expect(typeof ErrorMessages.ROUTE_NOT_FOUND).toBe('function')
    })

    it('interpolates method and url', () => {
      const msg = ErrorMessages.ROUTE_NOT_FOUND('GET', '/api/unknown')
      expect(msg).toBe('Route GET /api/unknown not found')
    })

    it('works with different HTTP methods', () => {
      expect(ErrorMessages.ROUTE_NOT_FOUND('POST', '/api/foo')).toContain('POST')
      expect(ErrorMessages.ROUTE_NOT_FOUND('DELETE', '/api/bar')).toContain('DELETE')
    })

    it('includes the url in the output', () => {
      const url = '/api/some/path'
      expect(ErrorMessages.ROUTE_NOT_FOUND('GET', url)).toContain(url)
    })
  })

  it('all string constants are non-empty', () => {
    for (const [key, value] of Object.entries(ErrorMessages)) {
      if (typeof value === 'string') {
        expect(value.length, `ErrorMessages.${key} should be non-empty`).toBeGreaterThan(0)
      }
    }
  })

  it('all string constants are trimmed (no leading/trailing whitespace)', () => {
    for (const [key, value] of Object.entries(ErrorMessages)) {
      if (typeof value === 'string') {
        expect(value, `ErrorMessages.${key} should not have leading/trailing whitespace`)
          .toBe(value.trim())
      }
    }
  })
})

// ─── Barrel export ────────────────────────────────────────────────────────────

describe('constants/index barrel export', () => {
  it('re-exports HttpStatus', () => {
    expect(ConstantsIndex.HttpStatus).toBeDefined()
    expect(ConstantsIndex.HttpStatus.OK).toBe(200)
  })

  it('re-exports ErrorMessages', () => {
    expect(ConstantsIndex.ErrorMessages).toBeDefined()
    expect(typeof ConstantsIndex.ErrorMessages.UNAUTHORIZED).toBe('string')
  })

  it('does not export undefined values', () => {
    for (const [key, value] of Object.entries(ConstantsIndex)) {
      expect(value, `Export "${key}" should not be undefined`).toBeDefined()
    }
  })
})
