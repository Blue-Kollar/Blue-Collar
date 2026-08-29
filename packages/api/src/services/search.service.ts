/**
 * Issue #747: Full-Text Worker Search Service
 *
 * PostgreSQL full-text search across worker name, bio, and category using
 * tsvector/tsquery with ts_rank relevance ordering, geo radius filtering,
 * rating/availability filters, and search analytics logging.
 */

import { db } from '../db.js'
import * as workerService from './worker.service.js'
import { WorkerResource } from '../resources/index.js'

const VALID_LANG_CONFIGS = new Set([
  'simple', 'english', 'french', 'german', 'spanish',
  'portuguese', 'italian', 'dutch', 'russian', 'arabic',
])

function safeLang(lang?: string): string {
  const l = (lang ?? 'simple').toLowerCase()
  return VALID_LANG_CONFIGS.has(l) ? l : 'simple'
}

export interface SearchFilters {
  query?: string
  lang?: string
  lat?: number
  lng?: number
  radius?: number       // km, default 10
  categories?: string[]
  minRating?: number
  maxRating?: number
  dayOfWeek?: number
  available?: boolean
  isVerified?: boolean
  sortBy?: 'relevance' | 'rating' | 'distance' | 'newest'
  page?: number
  limit?: number
}

export interface SearchResult {
  data: Array<Record<string, unknown> & {
    rank?: number
    distanceKm?: number
    highlight?: { name: string | null; bio: string | null }
  }>
  meta: { total: number; page: number; limit: number; pages: number }
}

/**
 * Full-text search with ranked results, geo filtering, and analytics logging.
 */
export async function searchWorkers(filters: SearchFilters, ipAddress?: string): Promise<SearchResult> {
  const {
    query,
    lang,
    lat,
    lng,
    radius = 10,
    categories,
    minRating,
    maxRating,
    dayOfWeek,
    isVerified,
    sortBy = 'relevance',
    page = 1,
    limit = 20,
  } = filters

  const safeLangVal = safeLang(lang)
  const limitNum = Math.min(Math.max(limit, 1), 100)
  const pageNum = Math.max(page, 1)
  const offset = (pageNum - 1) * limitNum

  // Build dynamic WHERE clauses
  const clauses: string[] = ['w."isActive" = true', 'w."deletedAt" IS NULL']
  const params: unknown[] = []
  let pi = 1

  const p = (val: unknown): string => {
    params.push(val)
    return '$' + pi++
  }

  // Full-text search
  const hasFts = query && query.trim()
  if (hasFts) {
    const qp = p(query!.trim())
    const lp = p(safeLangVal)
    clauses.push(`w."searchVector" @@ websearch_to_tsquery(${lp}::regconfig, ${qp})`)
  }

  if (categories && categories.length > 0) {
    const placeholders = categories.map(c => p(c)).join(', ')
    clauses.push(`w."categoryId" IN (${placeholders})`)
  }

  if (isVerified !== undefined) {
    clauses.push(`w."isVerified" = ${p(isVerified)}`)
  }

  if (minRating !== undefined) {
    clauses.push(
      `(SELECT AVG(rv.rating) FROM "Review" rv WHERE rv."workerId" = w.id) >= ${p(minRating)}`
    )
  }

  if (maxRating !== undefined) {
    clauses.push(
      `(SELECT AVG(rv.rating) FROM "Review" rv WHERE rv."workerId" = w.id) <= ${p(maxRating)}`
    )
  }

  if (dayOfWeek !== undefined) {
    clauses.push(
      `EXISTS (SELECT 1 FROM "Availability" av WHERE av."workerId" = w.id AND av."dayOfWeek" = ${p(dayOfWeek)})`
    )
  }

  // Geo bounding-box pre-filter (exact haversine done in-app)
  if (lat !== undefined && lng !== undefined) {
    const delta = radius / 111
    clauses.push(`loc.lat BETWEEN ${p(lat - delta)} AND ${p(lat + delta)}`)
    clauses.push(`loc.lng BETWEEN ${p(lng - delta)} AND ${p(lng + delta)}`)
  }

  const whereSQL = clauses.join('\n  AND ')

  // Build SELECT / ORDER depending on FTS
  let rankExpr = '0::float AS rank'
  let nameHL = 'w.name AS "nameHighlight"'
  let bioHL = `coalesce(w.bio, '') AS "bioHighlight"`
  let orderExpr = 'w."createdAt" DESC'

  if (hasFts) {
    // params[0]=query, params[1]=lang already set above (indices 1 and 2 in SQL)
    const qIdx = 1
    const lIdx = 2
    const tsq = `websearch_to_tsquery($${lIdx}::regconfig, $${qIdx})`
    rankExpr = `ts_rank(w."searchVector", ${tsq}) AS rank`
    nameHL = `ts_headline($${lIdx}::regconfig, w.name, ${tsq}, 'StartSel=<mark>, StopSel=</mark>') AS "nameHighlight"`
    bioHL  = `ts_headline($${lIdx}::regconfig, coalesce(w.bio, ''), ${tsq}, 'StartSel=<mark>, StopSel=</mark>, MaxFragments=2, MaxWords=15, MinWords=5') AS "bioHighlight"`

    if (sortBy === 'relevance') {
      orderExpr = 'rank DESC'
    }
  }

  if (sortBy === 'rating') orderExpr = '(SELECT AVG(rv.rating) FROM "Review" rv WHERE rv."workerId" = w.id) DESC NULLS LAST'
  if (sortBy === 'newest') orderExpr = 'w."createdAt" DESC'

  const limitParam = p(limitNum)
  const offsetParam = p(offset)

  const dataSQL = `
SELECT
  w.*,
  ${rankExpr},
  ${nameHL},
  ${bioHL},
  row_to_json(c.*)   AS category,
  row_to_json(u.*)   AS curator,
  row_to_json(loc.*) AS location
FROM "Worker" w
LEFT JOIN "Category" c   ON c.id   = w."categoryId"
LEFT JOIN "User"     u   ON u.id   = w."curatorId"
LEFT JOIN "Location" loc ON loc.id = w."locationId"
WHERE ${whereSQL}
ORDER BY ${orderExpr}
LIMIT ${limitParam} OFFSET ${offsetParam}
`

  const countSQL = `
SELECT COUNT(*) AS count
FROM "Worker" w
LEFT JOIN "Location" loc ON loc.id = w."locationId"
WHERE ${whereSQL}
`

  const [rows, countResult] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(dataSQL, ...params),
    db.$queryRawUnsafe<[{ count: bigint }]>(
      countSQL,
      ...params.slice(0, params.length - 2) // strip limit/offset from count query
    ),
  ])

  // Apply exact haversine geo filter post-query
  let results = rows
  if (lat !== undefined && lng !== undefined) {
    results = rows.filter(row => {
      const loc = row['location'] as any
      if (!loc?.lat || !loc?.lng) return false
      const dist = haversine(lat, lng, loc.lat, loc.lng)
      ;(row as any)['distanceKm'] = dist
      return dist <= radius
    })
    if (sortBy === 'distance') {
      results.sort((a, b) => ((a as any)['distanceKm'] ?? Infinity) - ((b as any)['distanceKm'] ?? Infinity))
    }
  }

  const total = Number(countResult[0]?.count ?? 0)

  // Log search analytics (fire-and-forget)
  if (query?.trim()) {
    db.searchAnalytics.create({
      data: {
        id: crypto.randomUUID(),
        query: query.trim(),
        resultsCount: results.length,
        hasFilters: !!(categories || lat || minRating !== undefined),
        ipAddress: ipAddress ?? null,
      },
    }).catch(() => {})
  }

  return {
    data: results.map(row => ({
      ...row,
      highlight: {
        name: (row['nameHighlight'] as string) ?? null,
        bio:  (row['bioHighlight']  as string) ?? null,
      },
      rank: parseFloat(String(row['rank'] ?? 0)),
    })),
    meta: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum),
    },
  }
}

export interface AdvancedSearchFilters {
  query?: string
  lat?: number
  lng?: number
  radius?: number
  categories?: string[]
  minRating?: number
  maxRating?: number
  dayOfWeek?: number
  startTime?: string
  endTime?: string
  isVerified?: boolean
  sortBy?: string
  page?: number
  limit?: number
}

export interface AdvancedSearchResult {
  data: ReturnType<typeof WorkerResource>[]
  meta: { total: number; page: number; limit: number; hasMore: boolean; pages: number }
}

/**
 * Advanced worker search: combines geo/rating/availability/category filters,
 * paginates, serializes results, and logs search analytics when a text query
 * was supplied. Consolidates what used to be inline logic in the search route
 * handler so the controller only has to parse the request and send the response.
 */
export async function performAdvancedSearch(
  filters: AdvancedSearchFilters,
  ipAddress: string,
): Promise<AdvancedSearchResult> {
  const page = Math.max(filters.page ?? 1, 1)
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 100)

  const result = await workerService.advancedSearch({
    query: filters.query,
    lat: filters.lat,
    lng: filters.lng,
    radius: filters.radius,
    categories: filters.categories,
    minRating: filters.minRating,
    maxRating: filters.maxRating,
    dayOfWeek: filters.dayOfWeek,
    startTime: filters.startTime,
    endTime: filters.endTime,
    isVerified: filters.isVerified,
    sortBy: filters.sortBy as any,
    skip: (page - 1) * limit,
    take: limit,
  })

  if (filters.query) {
    await workerService.trackSearchAnalytics(
      filters.query,
      result.data.length,
      !!(filters.lat || filters.categories || filters.minRating !== undefined),
      ipAddress,
    )
  }

  return {
    data: result.data.map((w) => WorkerResource(w)),
    meta: {
      total: result.total,
      page,
      limit,
      hasMore: result.hasMore,
      pages: Math.ceil(result.total / limit),
    },
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
