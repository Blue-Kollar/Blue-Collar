/**
 * Type-level and structural tests for the shared SDK API response types.
 * Issue #1237 — consolidated DTO/type definitions.
 *
 * These tests verify:
 *  1. ApiResponse carries the correct runtime shape
 *  2. PaginatedResult is a valid ApiResponse with non-optional meta
 *  3. PaginatedResponse is structurally identical to PaginatedResult (alias)
 *  4. Types previously duplicated in packages/api and packages/app
 *     now match the canonical SDK definitions
 */
import { describe, it, expect } from 'vitest'
import type { ApiResponse, PaginatedResult, PaginatedResponse, Meta } from './types.js'

// ── Runtime shape helpers ─────────────────────────────────────────────────────

function makeApiResponse<T>(data: T): ApiResponse<T> {
  return { status: 'success', code: 200, data }
}

function makeMeta(overrides: Partial<Meta> = {}): Meta {
  return { total: 100, page: 1, limit: 20, pages: 5, ...overrides }
}

function makePaginated<T>(data: T[]): PaginatedResult<T> {
  return {
    status: 'success',
    code: 200,
    data,
    meta: makeMeta({ total: data.length, pages: 1 }),
  }
}

// ── ApiResponse ───────────────────────────────────────────────────────────────

describe('ApiResponse', () => {
  it('accepts a success response with data', () => {
    const r = makeApiResponse({ id: '1', name: 'Alice' })
    expect(r.status).toBe('success')
    expect(r.code).toBe(200)
    expect(r.data?.name).toBe('Alice')
  })

  it('accepts a response without data (void / no-content endpoints)', () => {
    const r: ApiResponse = { status: 'success', code: 204 }
    expect(r.data).toBeUndefined()
  })

  it('accepts an error response shape', () => {
    const r: ApiResponse = {
      status: 'error',
      code: 400,
      message: 'Validation failed',
    }
    expect(r.status).toBe('error')
    expect(r.message).toBe('Validation failed')
  })

  it('accepts optional meta for list endpoints', () => {
    const r: ApiResponse<string[]> = {
      status: 'success',
      code: 200,
      data: ['a', 'b'],
      meta: makeMeta({ total: 2, pages: 1 }),
    }
    expect(r.meta?.total).toBe(2)
  })

  it('accepts optional token field (auth endpoints)', () => {
    const r: ApiResponse<{ id: string }> = {
      status: 'success',
      code: 200,
      data: { id: 'user-1' },
      token: 'jwt-token-here',
    }
    expect(r.token).toBe('jwt-token-here')
  })
})

// ── Meta ──────────────────────────────────────────────────────────────────────

describe('Meta', () => {
  it('carries all four pagination fields', () => {
    const m = makeMeta()
    expect(m).toMatchObject({ total: 100, page: 1, limit: 20, pages: 5 })
  })

  it('derives pages correctly for given total/limit', () => {
    const total = 47
    const limit = 20
    const pages = Math.ceil(total / limit)
    const m = makeMeta({ total, limit, pages })
    expect(m.pages).toBe(3)
  })
})

// ── PaginatedResult ───────────────────────────────────────────────────────────

describe('PaginatedResult', () => {
  it('is an ApiResponse with a required meta field', () => {
    const r = makePaginated([{ id: '1' }, { id: '2' }])
    expect(r.status).toBe('success')
    expect(r.meta).toBeDefined()
    expect(r.meta.total).toBe(2)
    expect(Array.isArray(r.data)).toBe(true)
  })

  it('data is always an array', () => {
    const r = makePaginated<number>([1, 2, 3])
    expect(r.data).toHaveLength(3)
  })

  it('meta pages is non-zero for non-empty results', () => {
    const r = makePaginated(['a', 'b'])
    expect(r.meta.pages).toBeGreaterThanOrEqual(1)
  })
})

// ── PaginatedResponse (alias) ─────────────────────────────────────────────────

describe('PaginatedResponse', () => {
  it('is structurally identical to PaginatedResult', () => {
    // Construct via PaginatedResult — assign to PaginatedResponse to confirm
    // they are the same structural type (TypeScript would error if not)
    const asResult: PaginatedResult<string> = makePaginated(['x', 'y'])
    const asResponse: PaginatedResponse<string> = asResult
    expect(asResponse.meta.total).toBe(asResult.meta.total)
  })
})

// ── Shape consistency with packages/api and packages/app ─────────────────────

describe('Shape consistency (issue #1237 regression)', () => {
  it('sdk ApiResponse.meta matches the packages/api meta shape', () => {
    // packages/api previously used { meta: { total, page, limit, pages } }
    // packages/app previously used { meta: { total, page, limit, pages } }
    // Both now share the SDK Meta interface — verify field names are identical
    const m = makeMeta({ total: 50, page: 2, limit: 10, pages: 5 })
    expect(Object.keys(m).sort()).toEqual(['limit', 'page', 'pages', 'total'])
  })

  it('ApiResponse status field is a union not a plain string', () => {
    // The api package previously typed status as string; the app typed it as string.
    // The canonical SDK type restricts to "success" | "error".
    const ok: ApiResponse['status'] = 'success'
    const err: ApiResponse['status'] = 'error'
    expect(['success', 'error']).toContain(ok)
    expect(['success', 'error']).toContain(err)
  })

  it('PaginatedResult meta is required (not optional)', () => {
    // packages/app's PaginatedResponse required meta; packages/api's PaginatedResult
    // also required meta.  The canonical type preserves this contract.
    const r = makePaginated([1, 2, 3])
    // TypeScript enforces this at compile time; this runtime check confirms the value
    expect(r.meta).toBeDefined()
  })
})
