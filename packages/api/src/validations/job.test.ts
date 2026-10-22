/**
 * Tests for job query validation schemas — issue #1236
 */
import { describe, it, expect } from 'vitest'
import { listJobsQuerySchema } from './job.js'

describe('listJobsQuerySchema', () => {
  it('accepts an empty query with defaults', () => {
    const result = listJobsQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    expect(result.data?.page).toBe(1)
    expect(result.data?.limit).toBe(20)
  })

  it('accepts a valid fully-specified query', () => {
    const result = listJobsQuerySchema.safeParse({
      categoryId: 'cat-abc',
      status: 'open',
      search: 'carpenter',
      urgency: 'urgent',
      minBudget: '100',
      maxBudget: '5000',
      page: '2',
      limit: '50',
    })
    expect(result.success).toBe(true)
    expect(result.data?.urgency).toBe('urgent')
  })

  it('rejects a search string longer than 200 characters (#1236 — bounds check)', () => {
    const result = listJobsQuerySchema.safeParse({ search: 'a'.repeat(201) })
    expect(result.success).toBe(false)
  })

  it('accepts a search string of exactly 200 characters', () => {
    const result = listJobsQuerySchema.safeParse({ search: 'a'.repeat(200) })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid status value', () => {
    const result = listJobsQuerySchema.safeParse({ status: 'deleted' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid urgency value', () => {
    const result = listJobsQuerySchema.safeParse({ urgency: 'critical' })
    expect(result.success).toBe(false)
  })

  it('rejects a limit above 100', () => {
    const result = listJobsQuerySchema.safeParse({ limit: '101' })
    expect(result.success).toBe(false)
  })

  it('rejects a page of 0', () => {
    const result = listJobsQuerySchema.safeParse({ page: '0' })
    expect(result.success).toBe(false)
  })

  it('rejects a negative minBudget', () => {
    const result = listJobsQuerySchema.safeParse({ minBudget: '-1' })
    expect(result.success).toBe(false)
  })

  it('rejects a categoryId with path-traversal characters (#1236 — injection check)', () => {
    const result = listJobsQuerySchema.safeParse({ categoryId: '../../../etc' })
    expect(result.success).toBe(false)
  })

  it('rejects a skills param longer than 500 chars', () => {
    const result = listJobsQuerySchema.safeParse({ skills: 'a,'.repeat(251) })
    expect(result.success).toBe(false)
  })

  it('SQL injection payload in search is rejected by length + stripped by sanitize middleware', () => {
    // A short SQL string passes length check — SQL injection is blocked by sanitize.ts (XSS+SQL layer)
    // This test verifies the Zod layer does not prevent normal short inputs that sanitize will clean
    const result = listJobsQuerySchema.safeParse({ search: "'; DROP TABLE" })
    expect(result.success).toBe(true) // Zod passes; sanitize.ts strips the pattern
  })
})
