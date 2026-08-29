/**
 * Tests for analytics/shared.ts — pure date/math/CSV helpers.
 * No DB access; all assertions are deterministic.
 */
import { describe, it, expect } from 'vitest'
import {
  daysAgo,
  daysBefore,
  parseDateBoundary,
  dateRangeWhere,
  getPreviousRange,
  dayKey,
  toRangePayload,
  buildDailyMap,
  calcGrowthPct,
  calcRatingDelta,
  csvEscape,
} from './shared.js'

// ── daysAgo ──────────────────────────────────────────────────────────────────

describe('daysAgo', () => {
  it('returns a Date exactly N days before today at UTC midnight', () => {
    const result = daysAgo(7)
    const expected = new Date()
    expected.setDate(expected.getDate() - 7)
    expected.setUTCHours(0, 0, 0, 0)
    // Allow ±1 second tolerance for test runtime
    expect(Math.abs(result.getTime() - expected.getTime())).toBeLessThan(1000)
  })

  it('returns UTC midnight (hours 0, minutes 0, seconds 0, ms 0)', () => {
    const result = daysAgo(3)
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
    expect(result.getUTCSeconds()).toBe(0)
    expect(result.getUTCMilliseconds()).toBe(0)
  })
})

// ── daysBefore ───────────────────────────────────────────────────────────────

describe('daysBefore', () => {
  it('returns a Date N days before the anchor', () => {
    const anchor = new Date('2026-01-10T12:00:00Z')
    const result = daysBefore(anchor, 5)
    expect(result.toISOString().slice(0, 10)).toBe('2026-01-05')
  })

  it('floors to UTC midnight', () => {
    const anchor = new Date('2026-06-15T18:30:00Z')
    const result = daysBefore(anchor, 1)
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
  })
})

// ── parseDateBoundary ────────────────────────────────────────────────────────

describe('parseDateBoundary', () => {
  it('returns undefined when value is falsy', () => {
    expect(parseDateBoundary(undefined, 'start')).toBeUndefined()
    expect(parseDateBoundary('', 'end')).toBeUndefined()
  })

  it('floors start boundary to UTC 00:00:00', () => {
    const result = parseDateBoundary('2026-03-15T18:30:00Z', 'start')!
    expect(result.getUTCHours()).toBe(0)
    expect(result.getUTCMinutes()).toBe(0)
  })

  it('ceils end boundary to UTC 23:59:59', () => {
    const result = parseDateBoundary('2026-03-15', 'end')!
    expect(result.getUTCHours()).toBe(23)
    expect(result.getUTCMinutes()).toBe(59)
    expect(result.getUTCSeconds()).toBe(59)
  })

  it('throws on an invalid date string', () => {
    expect(() => parseDateBoundary('not-a-date', 'start')).toThrow()
  })
})

// ── dateRangeWhere ───────────────────────────────────────────────────────────

describe('dateRangeWhere', () => {
  it('returns a Prisma-style gte/lte object', () => {
    const start = new Date('2026-01-01')
    const end = new Date('2026-01-31')
    expect(dateRangeWhere({ startDate: start, endDate: end })).toEqual({ gte: start, lte: end })
  })
})

// ── getPreviousRange ─────────────────────────────────────────────────────────

describe('getPreviousRange', () => {
  it('returns a range of equal duration immediately before the supplied range', () => {
    const range = {
      startDate: new Date('2026-02-01T00:00:00Z'),
      endDate: new Date('2026-02-28T23:59:59Z'),
    }
    const prev = getPreviousRange(range)

    const duration = range.endDate.getTime() - range.startDate.getTime()
    const prevDuration = prev.endDate.getTime() - prev.startDate.getTime()
    expect(prevDuration).toBe(duration)

    // The previous range should end just before the current range starts
    expect(prev.endDate.getTime()).toBe(range.startDate.getTime() - 1)
  })
})

// ── dayKey ───────────────────────────────────────────────────────────────────

describe('dayKey', () => {
  it('returns YYYY-MM-DD from a Date', () => {
    expect(dayKey(new Date('2026-07-04T12:00:00Z'))).toBe('2026-07-04')
  })
})

// ── toRangePayload ───────────────────────────────────────────────────────────

describe('toRangePayload', () => {
  it('serialises both dates to YYYY-MM-DD strings', () => {
    const range = {
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-01-31T23:59:59Z'),
    }
    expect(toRangePayload(range)).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' })
  })
})

// ── buildDailyMap ────────────────────────────────────────────────────────────

describe('buildDailyMap', () => {
  it('creates one entry per calendar day in the range (inclusive)', () => {
    const range = {
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-01-05T23:59:59Z'),
    }
    const map = buildDailyMap(range)
    expect(map.size).toBe(5)
    expect(map.has('2026-01-01')).toBe(true)
    expect(map.has('2026-01-05')).toBe(true)
  })

  it('initialises each point with zeroed numeric fields', () => {
    const range = {
      startDate: new Date('2026-06-01T00:00:00Z'),
      endDate: new Date('2026-06-01T23:59:59Z'),
    }
    const map = buildDailyMap(range)
    const point = map.get('2026-06-01')!
    expect(point.views).toBe(0)
    expect(point.uniqueViews).toBe(0)
    expect(point.tips).toBe(0)
    expect(point.tipCount).toBe(0)
    expect(point.reviewCount).toBe(0)
    expect(point.earnings).toBe(0)
    expect(point.avgRating).toBeNull()
  })
})

// ── calcGrowthPct ────────────────────────────────────────────────────────────

describe('calcGrowthPct', () => {
  it('returns 100 when previous is 0 and current is positive', () => {
    expect(calcGrowthPct(10, 0)).toBe(100)
  })

  it('returns 0 when both are zero', () => {
    expect(calcGrowthPct(0, 0)).toBe(0)
  })

  it('calculates positive growth correctly', () => {
    expect(calcGrowthPct(150, 100)).toBe(50)
  })

  it('calculates negative growth correctly', () => {
    expect(calcGrowthPct(50, 100)).toBe(-50)
  })

  it('rounds to nearest integer', () => {
    expect(calcGrowthPct(1, 3)).toBe(-67)
  })
})

// ── calcRatingDelta ──────────────────────────────────────────────────────────

describe('calcRatingDelta', () => {
  it('returns 0 when both are null', () => {
    expect(calcRatingDelta(null, null)).toBe(0)
  })

  it('returns delta rounded to one decimal', () => {
    expect(calcRatingDelta(4.5, 4.0)).toBe(0.5)
    expect(calcRatingDelta(3.8, 4.2)).toBeCloseTo(-0.4, 5)
  })

  it('treats null as 0', () => {
    expect(calcRatingDelta(3.5, null)).toBe(3.5)
    expect(calcRatingDelta(null, 2.0)).toBe(-2.0)
  })
})

// ── csvEscape ────────────────────────────────────────────────────────────────

describe('csvEscape', () => {
  it('returns plain strings unchanged', () => {
    expect(csvEscape('John Smith')).toBe('John Smith')
  })

  it('wraps strings containing commas in double quotes', () => {
    expect(csvEscape('Smith, John')).toBe('"Smith, John"')
  })

  it('escapes internal double-quotes by doubling them', () => {
    expect(csvEscape('say "hello"')).toBe('"say ""hello"""')
  })

  it('wraps strings containing newlines', () => {
    const result = csvEscape('line1\nline2')
    expect(result.startsWith('"')).toBe(true)
    expect(result.endsWith('"')).toBe(true)
  })
})
