/**
 * Shared date/math helpers for analytics sub-modules.
 * These are pure functions with no side effects and no DB access,
 * so they can be imported by any sub-module without risk of circular
 * dependencies.
 */

export type DateRange = {
  startDate?: Date
  endDate?: Date
}

export type TimeSeriesPoint = {
  date: string
  views: number
  uniqueViews: number
  tips: number
  tipCount: number
  avgRating: number | null
  reviewCount: number
  earnings: number
}

// ── Date helpers ─────────────────────────────────────────────────────────────

/** Returns a Date N calendar days ago at UTC midnight. */
export function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Returns a Date that is `days` before `anchor` at UTC midnight. */
export function daysBefore(anchor: Date, days: number): Date {
  const d = new Date(anchor)
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Parses a raw query value into a Date boundary.
 * Start boundaries are floored to UTC 00:00:00; end boundaries are ceiled to 23:59:59.
 */
export function parseDateBoundary(value: unknown, boundary: 'start' | 'end'): Date | undefined {
  if (!value) return undefined
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) {
    // Callers (parseAnalyticsDateRange) convert this into an AppError
    throw new Error(`Invalid ${boundary === 'start' ? 'startDate' : 'endDate'}`)
  }
  if (boundary === 'start') date.setUTCHours(0, 0, 0, 0)
  else date.setUTCHours(23, 59, 59, 999)
  return date
}

/** Prisma `where` clause for a date range on a single date field. */
export function dateRangeWhere(range: Required<DateRange>) {
  return { gte: range.startDate, lte: range.endDate }
}

/** Returns the preceding range of equal duration immediately before `range`. */
export function getPreviousRange(range: Required<DateRange>): Required<DateRange> {
  const duration = range.endDate.getTime() - range.startDate.getTime()
  const endDate = new Date(range.startDate.getTime() - 1)
  const startDate = new Date(endDate.getTime() - duration)
  return { startDate, endDate }
}

/** ISO-8601 date key (YYYY-MM-DD) for a given Date. */
export function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Serialises a DateRange to plain-string start/end keys for API responses. */
export function toRangePayload(range: Required<DateRange>) {
  return {
    startDate: dayKey(range.startDate),
    endDate: dayKey(range.endDate),
  }
}

/**
 * Builds an ordered Map of YYYY-MM-DD → empty TimeSeriesPoint
 * covering every calendar day in `range`.
 */
export function buildDailyMap(range: Required<DateRange>): Map<string, TimeSeriesPoint> {
  const map = new Map<string, TimeSeriesPoint>()
  const cursor = new Date(range.startDate)
  cursor.setUTCHours(0, 0, 0, 0)
  const end = new Date(range.endDate)
  end.setUTCHours(0, 0, 0, 0)

  while (cursor <= end) {
    const date = dayKey(cursor)
    map.set(date, { date, views: 0, uniqueViews: 0, tips: 0, tipCount: 0, avgRating: null, reviewCount: 0, earnings: 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return map
}

// ── Math helpers ─────────────────────────────────────────────────────────────

/** Growth percentage from `previous` to `current`, rounded to the nearest integer. */
export function calcGrowthPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

/** Delta in average rating, rounded to one decimal place. */
export function calcRatingDelta(current: number | null, previous: number | null): number {
  return Math.round(((current ?? 0) - (previous ?? 0)) * 10) / 10
}

// ── CSV helper ───────────────────────────────────────────────────────────────

/** RFC-4180 CSV escaping: wraps in double-quotes when the value contains commas, quotes, or newlines. */
export function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
