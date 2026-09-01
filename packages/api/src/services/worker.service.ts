import type { Prisma } from '@prisma/client'
import { db } from '../db.js'
import { AppError } from './AppError.js'
import { formatWorker } from '../models/worker.model.js'
import type { CreateWorkerBody, UpdateWorkerBody } from '../interfaces/index.js'
import { publishEvent } from './webhook.service.js'
import { appEvents } from '../events/app-events.js'
import { createServiceLogger } from '../utils/logger.js'
import { workerRepository } from '../repositories/worker.repository.js'
import { WorkerCollection } from '../resources/index.js'
import { processImage, deleteImages } from '../utils/imageProcessor.js'

const logger = createServiceLogger('WorkerService')
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

  const where: Prisma.WorkerWhereInput = {
    isActive: true,
    deletedAt: null,
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
    const havingClause: { gte?: number; lte?: number } = {}
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
  let orderBy: Prisma.WorkerOrderByWithRelationInput = { createdAt: 'desc' }
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

// ── Cursor-paginated listing (no offset/geo params) ─────────────────────────────

// Haversine distance in km between two lat/lng points
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function listWorkersCursor(opts: {
  category?: string
  categories?: string[]
  isVerified?: boolean
  city?: string
  state?: string
  country?: string
  available?: number
  listedSince?: number
  minRating?: number
  maxRating?: number
  search?: string
  cursor?: string
  limit: number
}) {
  const {
    category, categories, isVerified, city, state, country,
    available, listedSince, minRating, maxRating, search, cursor, limit,
  } = opts

  const categoryFilter = categories && categories.length > 0
    ? { categoryId: { in: categories } }
    : category
    ? { categoryId: category }
    : {}

  const where: Prisma.WorkerWhereInput = {
    isActive: true,
    ...categoryFilter,
    ...(isVerified !== undefined ? { isVerified } : {}),
    ...(city || state || country
      ? {
          location: {
            ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
            ...(state ? { state: { contains: state, mode: 'insensitive' as const } } : {}),
            ...(country ? { country: { contains: country, mode: 'insensitive' as const } } : {}),
          },
        }
      : {}),
    ...(available !== undefined ? { availability: { some: { dayOfWeek: available } } } : {}),
    ...(listedSince !== undefined
      ? { createdAt: { gte: new Date(Date.now() - listedSince * 365 * 24 * 60 * 60 * 1000) } }
      : {}),
    ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
  }

  if (minRating !== undefined || maxRating !== undefined) {
    const havingClause: { gte?: number; lte?: number } = {}
    if (minRating !== undefined) havingClause.gte = minRating
    if (maxRating !== undefined) havingClause.lte = maxRating
    const qualifiedIds = await db.review.groupBy({
      by: ['workerId'],
      _avg: { rating: true },
      having: { rating: { _avg: havingClause } },
    })
    where.id = { in: qualifiedIds.map((r: { workerId: string }) => r.workerId) }
  }

  const rows = await db.worker.findMany({
    where,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: limit + 1,
    include: { category: true, curator: true },
    orderBy: { createdAt: 'desc' },
  })
  const data = rows.slice(0, limit)

  return {
    // db.worker.findMany with `include: { category, curator }` returns the full relations
    // but TypeScript infers a nullable type for the relation fields. WorkerCollection
    // requires non-nullable relations; the shape is guaranteed by the include clause.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma nullable-relation inference vs WorkerWithRelations
    data: WorkerCollection(data as any),
    nextCursor: rows.length > limit ? data[data.length - 1]?.id ?? null : null,
  }
}

// ── Geo-radius listing (lat/lng/radius params) ───────────────────────────────────

export async function listWorkersGeo(opts: {
  lat: number
  lng: number
  radiusKm: number
  category?: string
  page: number
  limit: number
}) {
  const { lat, lng, radiusKm, category, page, limit } = opts

  // Bounding box pre-filter (1 degree ≈ 111 km)
  const delta = radiusKm / 111
  const workers = await db.worker.findMany({
    where: {
      isActive: true,
      location: {
        lat: { gte: lat - delta, lte: lat + delta },
        lng: { gte: lng - delta, lte: lng + delta },
      },
      ...(category ? { categoryId: category } : {}),
    },
    include: { category: true, location: true },
  })

  const withDistance = workers
    .filter(w => w.location?.lat != null && w.location?.lng != null)
    .map(w => ({ ...w, distanceKm: haversine(lat, lng, w.location!.lat!, w.location!.lng!) }))
    .filter(w => w.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)

  return withDistance.slice((page - 1) * limit, page * limit)
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
    '  AND w."deletedAt" IS NULL',
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
    '  AND w."deletedAt" IS NULL',
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
      // Raw SQL result is Record<string,unknown>; cast to the expected Prisma shape
      // which is guaranteed by the JOIN clauses in the FTS query above.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw SQL result cast to Prisma Worker shape
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
  const worker = await db.worker.findUnique({ where: { id, deletedAt: null }, include: workerInclude })
  if (!worker) throw new AppError('Not found', 404)
  return formatWorker(worker)
}

export async function createWorker(data: CreateWorkerBody, curatorId: string) {
  logger.debug('Creating worker', { curatorId, name: data.name })
  const worker = await db.worker.create({
    // `createdById` and `updatedById` are audit fields added by our schema but
    // not part of CreateWorkerBody — extend the Prisma input explicitly.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma.WorkerCreateInput vs CreateWorkerBody audit fields
    data: { ...data, curatorId, createdById: curatorId, updatedById: curatorId } as any,
    include: workerInclude,
  })
  publishEvent('worker.created', { worker: formatWorker(worker) }).catch(() => {})
  appEvents.emit('worker.created', { workerId: worker.id, curatorId })
  logger.info('Worker created successfully', { workerId: worker.id, curatorId })
  return formatWorker(worker)
}

export async function updateWorker(id: string, data: UpdateWorkerBody, updatedById?: string) {
  logger.debug('Updating worker', { workerId: id })
  const worker = await db.worker.update({
    where: { id },
    // `updatedById` is an audit field not present in UpdateWorkerBody.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Prisma.WorkerUpdateInput vs UpdateWorkerBody audit field
    data: { ...(data as any), ...(updatedById ? { updatedById } : {}) },
    include: workerInclude,
  })
  publishEvent('worker.updated', { worker: formatWorker(worker) }).catch(() => {})
  appEvents.emit('worker.updated', { workerId: id, curatorId: worker.curatorId })
  logger.info('Worker updated successfully', { workerId: id })
  return formatWorker(worker)
}

export async function deleteWorker(id: string) {
  logger.debug('Deleting worker', { workerId: id })
  await db.worker.update({ where: { id }, data: { deletedAt: new Date() } })
  publishEvent('worker.deleted', { workerId: id }).catch(() => {})
  appEvents.emit('worker.deleted', { workerId: id })
  logger.info('Worker deleted successfully', { workerId: id })
}

export async function restoreWorker(id: string) {
  logger.debug('Restoring worker', { workerId: id })
  const worker = await db.worker.findUnique({ where: { id } })
  if (!worker) {
    logger.warn('Restore failed: worker not found', { workerId: id })
    throw new AppError('Not found', 404)
  }
  if (!worker.deletedAt) {
    logger.warn('Restore failed: worker is not deleted', { workerId: id })
    throw new AppError('Worker is not deleted', 400)
  }
  const restored = await db.worker.update({ where: { id }, data: { deletedAt: null }, include: workerInclude })
  return formatWorker(restored)
}

export async function toggleWorker(id: string) {
  const worker = await db.worker.findUnique({ where: { id } })
  if (!worker) throw new AppError('Not found', 404)
  const updated = await db.worker.update({
    where: { id },
    data: { isActive: !worker.isActive },
    include: workerInclude,
  })
  appEvents.emit('worker.toggled', { workerId: id, isActive: updated.isActive })
  return formatWorker(updated)
}

/**
 * Get a single worker with its portfolio, ordered by `order`.
 * Used by the (currently unrouted) `showWorker` controller — kept distinct
 * from `getWorker` because it includes `portfolio` instead of `curator` and
 * returns `null` rather than throwing on a miss.
 */
export async function getWorkerWithPortfolio(id: string) {
  return db.worker.findUnique({
    where: { id },
    include: { category: true, portfolio: { orderBy: { order: 'asc' } } },
  })
}

export async function listMyWorkers(curatorId: string, page: number, limit: number) {
  const where = { curatorId }
  const [data, total] = await Promise.all([
    db.worker.findMany({
      where, skip: (page - 1) * limit, take: limit, include: { category: true }, orderBy: { createdAt: 'desc' },
    }),
    db.worker.count({ where }),
  ])
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

/** Build the image-variant fields (thumb/medium/full/avatar) from an uploaded file, if any. */
async function processedImageFields(file?: { path: string }): Promise<Record<string, string>> {
  if (!file) return {}
  const imgs = await processImage(file.path)
  return { imageThumb: imgs.thumb, imageMedium: imgs.medium, imageFull: imgs.full, avatar: imgs.full }
}

export async function createWorkerWithMedia(
  data: CreateWorkerBody,
  curatorId: string,
  file?: { path: string },
) {
  const imageFields = await processedImageFields(file)
  return createWorker({ ...data, ...imageFields }, curatorId)
}

/**
 * Update a worker, handling the multipart/method-override image upload path
 * (see README: POST + X-HTTP-Method: PUT). Deletes the old image variants
 * before writing new ones when a replacement file is uploaded.
 */
export async function updateWorkerWithMedia(
  id: string,
  data: UpdateWorkerBody,
  file: { path: string } | undefined,
  updatedById?: string,
) {
  if (file) {
    const existing = await db.worker.findUnique({ where: { id }, select: { imageFull: true } })
    if (existing?.imageFull) deleteImages(existing.imageFull)
  }
  const imageFields = await processedImageFields(file)
  return updateWorker(id, { ...data, ...imageFields }, updatedById)
}

export async function deleteWorkerWithMedia(id: string) {
  const existing = await db.worker.findUnique({ where: { id }, select: { imageFull: true } })
  if (existing?.imageFull) deleteImages(existing.imageFull)
  await deleteWorker(id)
}

/** Fire-and-forget search analytics tracking; silently no-ops if the table is unavailable. */
export async function trackSearchAnalytics(
  query: string,
  resultsCount: number,
  hasFilters: boolean,
  ipAddress: string,
) {
  await db.searchAnalytics?.create?.({
    data: { query, resultsCount, hasFilters, ipAddress },
  }).catch(() => {
    // Silently fail if analytics table doesn't exist
  })
}

/**
 * Advanced search with geographic, rating, availability, and category filters.
 * Combines multiple search criteria and calculates relevance scores.
 */
export async function advancedSearch(opts: {
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
  sortBy?: 'relevance' | 'rating' | 'distance' | 'newest' | 'reviews'
  skip?: number
  take?: number
}) {
  return workerRepository.advancedSearch({
    query: opts.query,
    lat: opts.lat,
    lng: opts.lng,
    radius: opts.radius,
    categories: opts.categories,
    minRating: opts.minRating,
    maxRating: opts.maxRating,
    dayOfWeek: opts.dayOfWeek,
    startTime: opts.startTime,
    endTime: opts.endTime,
    isVerified: opts.isVerified,
    sortBy: opts.sortBy,
    skip: opts.skip,
    take: opts.take,
  })
}
