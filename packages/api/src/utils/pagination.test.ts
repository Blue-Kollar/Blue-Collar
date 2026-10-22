import { describe, it, expect } from 'vitest'
import {
  parsePaginationParams,
  calculateSkipTake,
  buildPaginationMeta,
  createPaginationHelper,
  encodeCursor,
  decodeCursor,
} from './pagination.js'

describe('parsePaginationParams', () => {
  it('applies defaults when params are missing', () => {
    expect(parsePaginationParams({})).toEqual({ page: 1, limit: 20 })
  })

  it('parses string query params', () => {
    expect(parsePaginationParams({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10 })
  })

  it('clamps limit to maxLimit and page to a minimum of 1', () => {
    expect(parsePaginationParams({ page: '0', limit: '999' }, { maxLimit: 100 })).toEqual({ page: 1, limit: 100 })
  })

  it('falls back to defaults for invalid input', () => {
    expect(parsePaginationParams({ page: 'nope', limit: 'nope' })).toEqual({ page: 1, limit: 20 })
  })
})

describe('calculateSkipTake', () => {
  it('computes skip/take from page and limit', () => {
    expect(calculateSkipTake(1, 20)).toEqual({ skip: 0, take: 20 })
    expect(calculateSkipTake(3, 10)).toEqual({ skip: 20, take: 10 })
  })
})

describe('cursor encode/decode', () => {
  it('round-trips a record into an opaque cursor and back', () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z')
    const cursor = encodeCursor({ id: 'job_1', createdAt })
    expect(typeof cursor).toBe('string')
    expect(decodeCursor(cursor)).toEqual({ id: 'job_1', createdAt: createdAt.toISOString() })
  })

  it('returns null for a malformed cursor', () => {
    expect(decodeCursor('not-a-valid-cursor')).toBeNull()
  })
})

describe('buildPaginationMeta', () => {
  it('reports hasMore and a nextCursor when more pages exist', () => {
    const meta = buildPaginationMeta(50, 1, 20, { id: 'job_20', createdAt: new Date('2026-01-01') })
    expect(meta).toMatchObject({ total: 50, page: 1, limit: 20, pages: 3, hasMore: true })
    expect(meta.nextCursor).not.toBeNull()
  })

  it('has no nextCursor on the last page', () => {
    const meta = buildPaginationMeta(50, 3, 20, { id: 'job_50', createdAt: new Date('2026-01-01') })
    expect(meta.hasMore).toBe(false)
    expect(meta.nextCursor).toBeNull()
  })

  it('has no nextCursor when no lastRecord is supplied even if more pages exist', () => {
    const meta = buildPaginationMeta(50, 1, 20)
    expect(meta.hasMore).toBe(true)
    expect(meta.nextCursor).toBeNull()
  })
})

describe('createPaginationHelper', () => {
  it('parses a cursor query param alongside page/limit', () => {
    const cursor = encodeCursor({ id: 'job_1', createdAt: new Date('2026-01-01') })
    const helper = createPaginationHelper({ page: '2', limit: '10', cursor })
    expect(helper.page).toBe(2)
    expect(helper.limit).toBe(10)
    expect(helper.skip).toBe(10)
    expect(helper.cursor).toEqual({ id: 'job_1', createdAt: new Date('2026-01-01').toISOString() })
  })

  it('builds meta via buildMeta', () => {
    const helper = createPaginationHelper({ page: '1', limit: '20' })
    const meta = helper.buildMeta(45)
    expect(meta).toMatchObject({ total: 45, page: 1, limit: 20, pages: 3, hasMore: true })
  })
})
