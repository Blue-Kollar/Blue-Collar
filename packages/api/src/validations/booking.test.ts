/**
 * Booking validation schemas — issue #1582.
 * Confirms the booking request rules reject bad input before it reaches controllers.
 */
import { describe, it, expect } from 'vitest'
import { createBookingRules, listMyBookingsQuery } from './booking.js'

describe('createBookingRules', () => {
  const valid = {
    workerId: 'worker-1',
    startTime: '2026-11-01T09:00:00.000Z',
    endTime: '2026-11-01T11:00:00.000Z',
  }

  it('accepts a complete booking request', () => {
    expect(createBookingRules.safeParse(valid).success).toBe(true)
  })

  it('rejects a missing workerId', () => {
    const result = createBookingRules.safeParse({ ...valid, workerId: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('workerId is required')
  })

  it('rejects a startTime that is not an ISO-8601 datetime', () => {
    const result = createBookingRules.safeParse({ ...valid, startTime: '2026-11-01' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('startTime must be an ISO-8601 datetime')
  })

  it('rejects an endTime that is not an ISO-8601 datetime', () => {
    const result = createBookingRules.safeParse({ ...valid, endTime: 'tomorrow at noon' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('endTime must be an ISO-8601 datetime')
  })
})

describe('listMyBookingsQuery', () => {
  it('accepts an empty query', () => {
    expect(listMyBookingsQuery.safeParse({}).success).toBe(true)
  })

  it('accepts a known role and status', () => {
    expect(listMyBookingsQuery.safeParse({ role: 'worker', status: 'confirmed' }).success).toBe(true)
  })

  it('rejects an unknown role', () => {
    expect(listMyBookingsQuery.safeParse({ role: 'admin' }).success).toBe(false)
  })

  it('rejects an unknown status', () => {
    expect(listMyBookingsQuery.safeParse({ status: 'archived' }).success).toBe(false)
  })
})
