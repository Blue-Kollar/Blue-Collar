import { db } from '../db.js'
import { AppError } from './AppError.js'
import { formatWorker } from '../models/worker.model.js'
import type { CreateWorkerBody, UpdateWorkerBody } from '../interfaces/index.js'
import { publishEvent } from './webhook.service.js'

const workerInclude = { category: true, curator: true } as const

const VALID_LANG_CONFIGS = new Set([
  'simple', 'english', 'french', 'german', 'spanish',
  'portuguese', 'italian', 'dutch', 'russian', 'arabic',
])

function safeLang(lang?: string): string {
  const l = (lang ?? 'simple').toLowerCase()
  return VALID_LANG_CONFIGS.has(l) ? l : 'simple'
}

/**
 * List active workers with optional filters and pagination.
 * When `search` is provided, uses PostgreSQL full-text search (tsvector/tsquery)
 * with ts_rank ordering and ts_headline highlighting.
 * Supports multi-language via `lang` (PostgreSQL regconfig, default: 'simple').
 */
export async function listWorkers(opts: {
  category?: string
  categories?: string[]  // multi-category filter
  page?: number
  limit?: number
  search?: string
  lang?: string
  city?: string
  state?: string
  country?: string
  minRating?: number
  maxRating?: number
  available?: number
  listedSince?: number
  sortBy?: 'rating' | 'newest' | 'oldest' | 'name'
  sortOrder?: 'asc' | 'desc'
  isVerified?: boolean
}) {
  const {
    category, categories, page = 1, limit = 20, search, lang,
    city, state, country, minRating, maxRating, available, listedSince,
    sortBy = 'newest', sortOrder = 'desc', isVerified,
  } = opts

  if (search && search.trim()) {
    return listWorkersFullText({
      search: search.trim(),
      lang: safeLang(lang),
      category, categories, page, limit,
      city, state, country,
      minRating, maxRating, available, listedSince,
    })
  }

  // Build category filter: multi-category takes precedence over single
  const categoryFilter = categories && categories.length > 0
    ? { categoryId: { in: categories } }
    : category
    ? { categoryId: category }
    : {}

  const where: any = {
    isActive: true,
    ...categoryFilter,
    ...(isVerified !== undefined ? { isVerified } : {}),
    ...(city || state || country
      ? {
          location: {
            ...(city    ? { city:    { contains: city,    mode: 'insensitive' as const } } : {}),
            ...(state   ? { state:   { contains: state,   mode: 'insensitive' as const } } : {}),
            ...(country ? { country: { contains: country, mode: 'insensitive' as const } } : {}),
          },
        }
      : {}),
    ...(available !== undefined ? { availability: { some: { dayOfWeek: available } } } : {}),
    ...(listedSince !== undefined
      ? { createdAt: { gte: new Date(Date.now() - listedSince * 365 * 24 * 60 * 60 * 1000) } }
      : {}),
  }

  if (minRating !== undefined || maxRating !== undefined) {
    const havingClause: any = {}
    if (minRating !== undefined) havingClause.gte = minRating
    if (maxRating !== undefined) havingClause.lte = maxRating
    const qualifiedIds = await db.review.groupBy({
      by: ['workerId'],
      _avg: { rating: true },
      having: { rating: { _avg: havingClause } },
    })
    where.id = { in: qualifiedIds.map((r: { workerId: string }) => r.workerId) }
  }

  // Build orderBy
  let orderBy: any = { createdAt: 'desc' }
  if (sortBy === 'oldest') orderBy = { createdAt: 'asc' }
  else if (sortBy === 'name') orderBy = { name: sortOrder }
  else if (sortBy === 'newest') orderBy = { createdAt: sortOrder }
  // 'rating' sort is handled post-query since it requires aggregation

  const [data, total] = await Promise.all([
    db.worker.findMany({ where, skip: (page - 1) * limit, take: limit, include: workerInclude, orderBy }),
    db.worker.count({ where }),
  ])

  return {
    data: data.map(formatWorker),
    meta: { total, page, limit, pages: Math.ceil(total / limit) },
  }
}

// ── Full-text search ──────────────────────────────────────────────────────────

interface FtsOpts {
  search: string
  lang: string
  category?: string
  categories?: string[]
  page: number
  limit: number
  city?: string
  state?: string
  country?: string
  minRating?: number
  maxRating?: number
  available?: number
  listedSince?: number
}

// Helpers to build safe SQL param placeholders without template-literal issues
const p = (n: number) => '$' + n

async function listWorkersFullText(opts: FtsOpts) {
  const { search, lang, category, categories, page, limit, city, state, country, minRating, maxRating, available, listedSince } = opts
  const offset = (page - 1) * limit

  // Fixed: p(1)=search, p(2)=lang
  // Count query: extra filters start at p(3)
  // Data query:  p(3)=limit, p(4)=offset, extra filters start at p(5) — shift +2
  const extraClauses: string[] = []
  const extraParams: unknown[] = []
  let ci = 3

  // Multi-category: use IN clause
  if (categories && categories.length > 0) {
    const placeholders = categories.map(() => p(ci++)).join(', ')
    extraClauses.push('w."categoryId" IN (' + placeholders + ')')
    extraParams.push(...categories)
  } else if (category) {
    extraClauses.push('w."categoryId" = ' + p(ci++))
    extraParams.push(category)
  }
  if (city) {
    extraClauses.push('l.city ILIKE ' + p(ci++))
    extraParams.push('%' + city + '%')
  }
  if (state) {
    extraClauses.push('l.state ILIKE ' + p(ci++))
    extraParams.push('%' + state + '%')
  }
  if (country) {
    extraClauses.push('l.country ILIKE ' + p(ci++))
    extraParams.push('%' + country + '%')
  }
  if (available !== undefined) {
    extraClauses.push(
      'EXISTS (SELECT 1 FROM "Availability" av WHERE av."workerId" = w.id AND av."dayOfWeek" = ' + p(ci++) + ')'
    )
    extraParams.push(available)
  }
  if (listedSince !== undefined) {
    extraClauses.push('w."createdAt" >= ' + p(ci++))
    extraParams.push(new Date(Date.now() - listedSince * 365 * 24 * 60 * 60 * 1000))
  }
  if (minRating !== undefined) {
    extraClauses.push(
      '(SELECT AVG(rv.rating) FROM "Review" rv WHERE rv."workerId" = w.id) >= ' + p(ci++)
    )
    extraParams.push(minRating)
  }
  if (maxRating !== undefined) {
    extraClauses.push(
      '(SELECT AVG(rv.rating) FROM "Review" rv WHERE rv."workerId" = w.id) <= ' + p(ci++)
    )
    extraParams.push(maxRating)
  }

  const countWhere = extraClauses.length ? 'AND ' + extraClauses.join(' AND ') : ''
  // Shift param indices +2 for data query (limit and offset occupy p(3) and p(4))
  const dataWhere = countWhere.replace(/\$(\d+)/g, (_m: string, n: string) => p(Number(n) + 2))

  const hlBio  = 'StartSel=<mark>, StopSel=</mark>, MaxFragments=3, MaxWords=15, MinWords=5'
  const hlName = 'StartSel=<mark>, StopSel=</mark>'

  const tsq = 'websearch_to_tsquery(' + p(2) + '::regconfig, ' + p(1) + ')'

  const dataSQL = [
    'SELECT w.*,',
    '  ts_rank(w."searchVector", ' + tsq + ') AS rank,',
    '  ts_headline(' + p(2) + '::regconfig, coalesce(w.bio, \'\'), ' + tsq + ', \'' + hlBio  + '\') AS "bioHighlight",',
    '  ts_headline(' + p(2) + '::regconfig, w.name, '               + tsq + ', \'' + hlName + '\') AS "nameHighlight",',
    '  row_to_json(c.*)   AS category,',
    '  row_to_json(u.*)   AS curator,',
    '  row_to_json(loc.*) AS location',
    'FROM "Worker" w',
    'LEFT JOIN "Category" c   ON c.id   = w."categoryId"',
    'LEFT JOIN "User"     u   ON u.id   = w."curatorId"',
    'LEFT JOIN "Location" loc ON loc.id = w."locationId"',
    'WHERE w."isActive" = true',
    '  AND w."searchVector" @@ ' + tsq,
    '  ' + dataWhere,
    'ORDER BY rank DESC',
    'LIMIT ' + p(3) + ' OFFSET ' + p(4),
  ].join('\n')

  const tsqCount = 'websearch_to_tsquery(' + p(2) + '::regconfig, ' + p(1) + ')'
  const countSQL = [
    'SELECT COUNT(*) AS count',
    'FROM "Worker" w',
    'LEFT JOIN "Location" loc ON loc.id = w."locationId"',
    'WHERE w."isActive" = true',
    '  AND w."searchVector" @@ ' + tsqCount,
    '  ' + countWhere,
  ].join('\n')

  const [rows, countResult] = await Promise.all([
    db.$queryRawUnsafe<Record<string, unknown>[]>(dataSQL, search, lang, limit, offset, ...extraParams),
    db.$queryRawUnsafe<[{ count: bigint }]>(countSQL, search, lang, ...extraParams),
  ])

  const total = Number(countResult[0]?.count ?? 0)

  const data = rows.map((row: Record<string, unknown>) => ({
    ...formatWorker({
      ...row,
      category: row['category'],
      curator:  row['curator'],
      location: row['location'],
    } as any),
    highlight: {
      name: (row['nameHighlight'] as string) ?? null,
      bio:  (row['bioHighlight']  as string) ?? null,
    },
    rank: parseFloat(String(row['rank'] ?? 0)),
  }))

  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────

export async function getWorker(id: string) {
  const worker = await db.worker.findUnique({ where: { id }, include: workerInclude })
  if (!worker) throw new AppError('Not found', 404)
  return formatWorker(worker)
}

export async function createWorker(data: CreateWorkerBody, curatorId: string) {
  const worker = await db.worker.create({ data: { ...data, curatorId } as any, include: workerInclude })
  publishEvent('worker.created', { worker: formatWorker(worker) }).catch(() => {})
  return formatWorker(worker)
}

export async function updateWorker(id: string, data: UpdateWorkerBody) {
  const worker = await db.worker.update({ where: { id }, data: data as any, include: workerInclude })
  publishEvent('worker.updated', { worker: formatWorker(worker) }).catch(() => {})
  return formatWorker(worker)
}

export async function deleteWorker(id: string) {
  await db.worker.delete({ where: { id } })
  publishEvent('worker.deleted', { workerId: id }).catch(() => {})
}

export async function toggleWorker(id: string) {
  const worker = await db.worker.findUnique({ where: { id } })
  if (!worker) throw new AppError('Not found', 404)
  const updated = await db.worker.update({
    where: { id },
    data: { isActive: !worker.isActive },
    include: workerInclude,
  })
  return formatWorker(updated)
}
