/**
 * Tests for worker query validation schemas — issue #1236
 *
 * Verifies that the new listWorkersQuerySchema and searchWorkersQuerySchema
 * reject malicious/malformed inputs before they reach the database layer.
 */
import { describe, it, expect } from 'vitest'
import {
  listWorkersQuerySchema,
  searchWorkersQuerySchema,
  advancedSearchRules,
} from './worker.js'

// ── listWorkersQuerySchema ────────────────────────────────────────────────────

describe('listWorkersQuerySchema', () => {
  it('accepts a valid minimal query (empty object)', () => {
    const result = listWorkersQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.page).toBe(1)
    expect(result.data?.limit).toBe(20)
  })

  it('accepts a fully specified valid query', () => {
    const result = listWorkersQuerySchema.safeParse({
      search: 'plumber',
      category: 'cat-123',
      city: 'Lagos',
      minRating: '1',
      maxRating: '5',
      available: '1',
      sortBy: 'rating',
      sortOrder: 'desc',
      isVerified: 'true',
      page: '2',
      limit: '50',
    })
    expect(result.success).toBe(true)
    expect(result.data?.page).toBe(2)
    expect(result.data?.limit).toBe(50)
    expect(result.data?.isVerified).toBe(true)
  })

  it('rejects a search string longer than 200 characters', () => {
    const result = listWorkersQuerySchema.safeParse({ search: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts a search string of exactly 200 characters', () => {
    const result = listWorkersQuerySchema.safeParse({ search: 'a'.repeat(200) })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid sortBy value', () => {
    const result = listWorkersQuerySchema.safeParse({ sortBy: 'badvalue' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid sortOrder value', () => {
    const result = listWorkersQuerySchema.safeParse({ sortOrder: 'sideways' })
    expect(result.success).toBe(false)
  })

  it('rejects a limit above 100', () => {
    const result = listWorkersQuerySchema.safeParse({ limit: '999' })
    expect(result.success).toBe(false)
  })

  it('rejects a page of 0', () => {
    const result = listWorkersQuerySchema.safeParse({ page: '0' })
    expect(result.success).toBe(false)
  })

  it('rejects minRating below 1', () => {
    const result = listWorkersQuerySchema.safeParse({ minRating: '0' })
    expect(result.success).toBe(false)
  })

  it('rejects maxRating above 5', () => {
    const result = listWorkersQuerySchema.safeParse({ maxRating: '6' })
    expect(result.success).toBe(false)
  })

  it('rejects day of week outside 0-6', () => {
    const result = listWorkersQuerySchema.safeParse({ available: '7' })
    expect(result.success).toBe(false)
  })

  it('rejects a category id with path-traversal characters', () => {
    const result = listWorkersQuerySchema.safeParse({ category: '../../etc/passwd' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid lang value', () => {
    const result = listWorkersQuerySchema.safeParse({ lang: 'xss<script>' })
    expect(result.success).toBe(false)
  })

  it('accepts a valid lang value', () => {
    const result = listWorkersQuerySchema.safeParse({ lang: 'english' })
    expect(result.success).toBe(true)
  })

  it('rejects lat out of range', () => {
    const result = listWorkersQuerySchema.safeParse({ lat: '91', lng: '0' })
    expect(result.success).toBe(false)
  })

  it('rejects lng out of range', () => {
    const result = listWorkersQuerySchema.safeParse({ lat: '0', lng: '181' })
    expect(result.success).toBe(false)
  })
})

// ── searchWorkersQuerySchema ──────────────────────────────────────────────────

describe('searchWorkersQuerySchema', () => {
  it('accepts an empty query', () => {
    const result = searchWorkersQuerySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts a valid search query', () => {
    const result = searchWorkersQuerySchema.safeParse({ q: 'electrician', lang: 'english' })
    expect(result.success).toBe(true)
  })

  it('rejects a q string longer than 500 chars', () => {
    const result = searchWorkersQuerySchema.safeParse({ q: 'x'.repeat(501) })
    expect(result.success).toBe(false)
  })

  it('accepts exactly 500 chars in q', () => {
    const result = searchWorkersQuerySchema.safeParse({ q: 'x'.repeat(500) })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid sortBy value', () => {
    const result = searchWorkersQuerySchema.safeParse({ sortBy: 'injected' })
    expect(result.success).toBe(false)
  })

  it('rejects a limit above 100', () => {
    const result = searchWorkersQuerySchema.safeParse({ limit: '200' })
    expect(result.success).toBe(false)
  })

  it('rejects a page of 0', () => {
    const result = searchWorkersQuerySchema.safeParse({ page: '0' })
    expect(result.success).toBe(false)
  })

  it('rejects lat out of range', () => {
    const result = searchWorkersQuerySchema.safeParse({ lat: '-91' })
    expect(result.success).toBe(false)
  })

  it('coerces string booleans for isVerified', () => {
    const result = searchWorkersQuerySchema.safeParse({ isVerified: 'true' })
    expect(result.success).toBe(true)
    expect(result.data?.isVerified).toBe(true)
  })
})

// ── advancedSearchRules ───────────────────────────────────────────────────────

describe('advancedSearchRules', () => {
  it('accepts a valid advanced search query', () => {
    const result = advancedSearchRules.safeParse({
      query: 'welder',
      lat: '6.5',
      lng: '3.3',
      radius: '10',
      minRating: '3',
      maxRating: '5',
      dayOfWeek: '1',
      sortBy: 'relevance',
      page: '1',
      limit: '20',
    })
    expect(result.success).toBe(true)
  })

  it('rejects a radius above 1000', () => {
    const result = advancedSearchRules.safeParse({ radius: '2000' })
    expect(result.success).toBe(false)
  })

  it('rejects a day-of-week above 6', () => {
    const result = advancedSearchRules.safeParse({ dayOfWeek: '7' })
    expect(result.success).toBe(false)
  })
})
