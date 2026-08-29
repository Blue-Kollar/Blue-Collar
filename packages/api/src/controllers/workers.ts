import type { Request, Response } from 'express'
import * as workerService from '../services/worker.service.js'
import * as searchService from '../services/search.service.js'
import { handleError } from '../utils/handleError.js'
import { catchAsync } from '../utils/catchAsync.js'
import { workerSerializer } from '../serializers/index.js'
import type { CreateWorkerBody, UpdateWorkerBody } from '../interfaces/index.js'
import { invalidateCachePattern } from '../middleware/cache.js'
import { getWorkerReputation, syncReputationToDb } from '../services/stellar.service.js'

// Parse a comma-separated ?fields= query param into a set for O(1) lookup.
// An empty/absent param means "return all fields".
function parseFields(raw: unknown): Set<string> | null {
  if (!raw) return null
  const fields = String(raw).split(',').map(f => f.trim()).filter(Boolean)
  return fields.length > 0 ? new Set(fields) : null
}

// Apply a sparse fieldset to an object, keeping only the requested keys.
function sparseFields(
  obj: Record<string, unknown>,
  fields: Set<string> | null,
): Record<string, unknown> {
  if (!fields) return obj
  return Object.fromEntries([...fields].filter(f => f in obj).map(f => [f, obj[f]]))
}

function parseCategoryIds(categories: unknown): string[] | undefined {
  return categories
    ? String(categories).split(',').map(s => s.trim()).filter(Boolean)
    : undefined
}

// Cursor-paginated mode: no `page`/`lat`/`lng` query params.
async function listWorkersCursorMode(query: Record<string, unknown>, fieldSet: Set<string> | null, limitNum: number, res: Response) {
  const {
    category, categories, isVerified, city, state, country,
    available, listedSince, minRating, maxRating, search, cursor,
  } = query

  const result = await workerService.listWorkersCursor({
    category: category ? String(category) : undefined,
    categories: parseCategoryIds(categories),
    isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
    city: city ? String(city) : undefined,
    state: state ? String(state) : undefined,
    country: country ? String(country) : undefined,
    available: available !== undefined ? Number(available) : undefined,
    listedSince: listedSince !== undefined ? Number(listedSince) : undefined,
    minRating: minRating !== undefined ? Number(minRating) : undefined,
    maxRating: maxRating !== undefined ? Number(maxRating) : undefined,
    search: search ? String(search) : undefined,
    cursor: cursor ? String(cursor) : undefined,
    limit: limitNum,
  })

  return res.json({
    data: result.data.map(w => sparseFields(w as Record<string, unknown>, fieldSet)),
    nextCursor: result.nextCursor,
    limit: limitNum,
    status: 'success',
    code: 200,
  })
}

// Geo-radius mode: `lat`/`lng` (optionally `radius`, `page`) query params.
async function listWorkersGeoMode(query: Record<string, unknown>, fieldSet: Set<string> | null, limitNum: number, res: Response) {
  const { category, page, lat, lng, radius } = query
  const userLat = Number(lat)
  const userLng = Number(lng)
  const radiusKm = radius ? Number(radius) : 10

  if (isNaN(userLat) || isNaN(userLng) || isNaN(radiusKm))
    return res.status(400).json({ status: 'error', message: 'Invalid lat, lng, or radius', code: 400 })

  const paginated = await workerService.listWorkersGeo({
    lat: userLat, lng: userLng, radiusKm,
    category: category ? String(category) : undefined,
    page: Number(page),
    limit: limitNum,
  })
  const geoData = fieldSet
    ? paginated.map(w => sparseFields(w as Record<string, unknown>, fieldSet))
    : paginated
  return res.json({ data: geoData, status: 'success', code: 200 })
}

// Offset-paginated mode (default): `page` provided without `lat`/`lng`.
async function listWorkersOffsetMode(query: Record<string, unknown>, fieldSet: Set<string> | null, limitNum: number, res: Response) {
  const {
    category, categories, page, search, lang, city, state, country,
    minRating, maxRating, available, listedSince, sortBy, sortOrder, isVerified,
  } = query

  const result = await workerService.listWorkers({
    category: category ? String(category) : undefined,
    categories: parseCategoryIds(categories),
    page: Number(page ?? 1),
    limit: limitNum,
    search: search ? String(search) : undefined,
    lang: lang ? String(lang) : undefined,
    city: city ? String(city) : undefined,
    state: state ? String(state) : undefined,
    country: country ? String(country) : undefined,
    minRating: minRating ? Number(minRating) : undefined,
    maxRating: maxRating ? Number(maxRating) : undefined,
    available: available !== undefined ? Number(available) : undefined,
    listedSince: listedSince ? Number(listedSince) : undefined,
    sortBy: sortBy as any,
    sortOrder: sortOrder as any,
    isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
  })

  const resultData = fieldSet && Array.isArray((result as any).data)
    ? { ...result, data: (result as any).data.map((w: Record<string, unknown>) => sparseFields(w, fieldSet)) }
    : result
  return res.json({ ...resultData, status: 'success', code: 200 })
}

export async function listWorkers(req: Request, res: Response) {
  const query = req.query as Record<string, unknown>
  const { page, lat, lng, limit = '20', fields: fieldsParam } = query
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100)
  const fieldSet = parseFields(fieldsParam)

  if (!page && !lat && !lng) return listWorkersCursorMode(query, fieldSet, limitNum, res)
  if (lat && lng) return listWorkersGeoMode(query, fieldSet, limitNum, res)
  return listWorkersOffsetMode(query, fieldSet, limitNum, res)
}

/**
 * GET /api/workers/:id
 * Get a single worker by id, with its portfolio.
 *
 * Not currently wired to a route — `showWorkerWithRatings` in
 * `routes/workers.ts` serves `GET /:id` instead — but kept and tested since
 * other code may still import it directly.
 *
 * @param req - Route param `id`.
 * @param res - JSON `{ data: Worker, status, code }` or 404.
 */
export async function showWorker(req: Request, res: Response) {
  const worker = await workerService.getWorkerWithPortfolio(req.params.id)
  if (!worker) return res.status(404).json({ status: 'error', message: 'Not found', code: 404 })
  return res.json({ data: worker, status: 'success', code: 200 })
}

/**
 * POST /api/workers
 * Create a new worker listing. Requires `curator` role.
 *
 * @param req - Body: `CreateWorkerBody`. `req.user` must be set by auth middleware.
 * @param res - JSON `{ data: Worker, status, code: 201 }`.
 */
export async function createWorker(req: Request<{}, {}, CreateWorkerBody>, res: Response) {
  try {
    const worker = await workerService.createWorkerWithMedia(req.body, req.user!.id, req.file)
    await invalidateCachePattern(`cache:*workers?*`)
    return res.status(201).json({
      data: workerSerializer.serialize(worker as any),
      status: 'success',
      code: 201
    })
  } catch (err) {
    return handleError(res, err)
  }
}

/**
 * PUT /api/workers/:id
 * Update an existing worker listing. Requires `curator` role.
 *
 * Supports both JSON and multipart/form-data requests:
 * - JSON: Standard PUT with Content-Type: application/json
 * - Multipart: POST with X-HTTP-Method: PUT header (method-override pattern)
 *
 * The method-override middleware (configured in src/index.ts) checks for the
 * X-HTTP-Method header and rewrites req.method accordingly. This allows HTML forms
 * and browsers to send file uploads with PUT semantics, since HTML forms only
 * support GET and POST methods.
 *
 * Example multipart request:
 *   POST /api/workers/:id
 *   X-HTTP-Method: PUT
 *   Content-Type: multipart/form-data
 *   Authorization: Bearer <token>
 *
 * @param req - Route param `id`. Body: `UpdateWorkerBody` (JSON or multipart).
 * @param res - JSON `{ data: Worker, status, code }`.
 */
export async function updateWorker(req: Request<{ id: string }, {}, UpdateWorkerBody>, res: Response) {
  try {
    const worker = await workerService.updateWorkerWithMedia(req.params.id, req.body, req.file, req.user?.id)
    await invalidateCachePattern(`cache:*workers/${req.params.id}*`)
    await invalidateCachePattern(`cache:*workers?*`)
    return res.json({
      data: workerSerializer.serialize(worker as any),
      status: 'success',
      code: 200
    })
  } catch (err) {
    return handleError(res, err)
  }
}

/**
 * DELETE /api/workers/:id
 * Delete a worker listing. Requires `curator` role.
 *
 * @param req - Route param `id`.
 * @param res - 204 No Content on success.
 */
export async function deleteWorker(req: Request, res: Response) {
  try {
    await workerService.deleteWorkerWithMedia(req.params.id as string)
    await invalidateCachePattern(`cache:*workers/${req.params.id}*`)
    await invalidateCachePattern(`cache:*workers?*`)
    return res.status(204).send()
  } catch (err) {
    return handleError(res, err)
  }
}

/**
 * PATCH /api/workers/:id/toggle
 * Toggle a worker's `isActive` status. Requires `curator` role.
 *
 * @param req - Route param `id`.
 * @param res - JSON `{ data: Worker, status, code }`.
 */
export async function toggleActivation(req: Request, res: Response) {
  try {
    const updated = await workerService.toggleWorker(req.params.id as string)
    await invalidateCachePattern(`cache:*workers/${req.params.id}*`)
    await invalidateCachePattern(`cache:*workers?*`)
    return res.json({
      data: workerSerializer.serialize(updated as any),
      status: 'success',
      code: 200
    })
  } catch (err) {
    return handleError(res, err)
  }
}

/**
 * GET /api/workers/mine
 * List workers created by the authenticated curator.
 *
 * @param req - Query params: `page`, `limit`. `req.user` must be set by auth middleware.
 * @param res - JSON `{ data: Worker[], meta, status, code }`.
 */
export async function listMyWorkers(req: Request, res: Response) {
  const { page = '1', limit = '20' } = req.query
  const result = await workerService.listMyWorkers(req.user!.id, Number(page), Number(limit))
  return res.json({ ...result, status: 'success', code: 200 })
}

export type SearchService = Pick<typeof searchService, 'searchWorkers' | 'performAdvancedSearch'>

/**
 * Builds the /search route handlers on top of an injected search service.
 * Defaults to the real `search.service.js` module so route wiring is
 * unchanged; tests can pass a fake service to exercise handlers in isolation.
 */
export function createSearchHandlers(service: SearchService = searchService) {
  return {
    /**
     * GET /api/workers/search
     * Full-text worker search with ranked results, geo radius, rating, and availability filters.
     * Issue #747
     */
    searchWorkersHandler: catchAsync(async (req: Request, res: Response) => {
      const {
        q, query, lang, lat, lng, radius,
        categories, minRating, maxRating,
        dayOfWeek, isVerified, sortBy,
        page = '1', limit = '20',
      } = req.query

      const result = await service.searchWorkers({
        query: (q || query) ? String(q ?? query) : undefined,
        lang: lang ? String(lang) : undefined,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        radius: radius ? Number(radius) : undefined,
        categories: categories ? String(categories).split(',').map(c => c.trim()).filter(Boolean) : undefined,
        minRating: minRating ? Number(minRating) : undefined,
        maxRating: maxRating ? Number(maxRating) : undefined,
        dayOfWeek: dayOfWeek !== undefined ? Number(dayOfWeek) : undefined,
        isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
        sortBy: sortBy as any,
        page: Number(page),
        limit: Math.min(Math.max(Number(limit) || 20, 1), 100),
      }, req.ip)

      return res.json({ ...result, status: 'success', code: 200 })
    }),

    /**
     * GET /api/workers/search/advanced
     * Advanced search with filtering by location, rating, availability, and categories.
     *
     * @param req - Query params: query, lat, lng, radius, categories, minRating, maxRating, dayOfWeek, startTime, endTime, isVerified, sortBy, page, limit
     * @param res - JSON with paginated results, total count, and hasMore flag
     */
    advancedSearch: catchAsync(async (req: Request, res: Response) => {
      const {
        query, lat, lng, radius, categories, minRating, maxRating,
        dayOfWeek, startTime, endTime, isVerified, sortBy,
        page = '1', limit = '20',
      } = req.query

      const result = await service.performAdvancedSearch({
        query: query ? String(query) : undefined,
        lat: lat ? Number(lat) : undefined,
        lng: lng ? Number(lng) : undefined,
        radius: radius ? Number(radius) : undefined,
        categories: categories ? String(categories).split(',').map(c => c.trim()).filter(Boolean) : undefined,
        minRating: minRating ? Number(minRating) : undefined,
        maxRating: maxRating ? Number(maxRating) : undefined,
        dayOfWeek: dayOfWeek ? Number(dayOfWeek) : undefined,
        startTime: startTime ? String(startTime) : undefined,
        endTime: endTime ? String(endTime) : undefined,
        isVerified: isVerified !== undefined ? isVerified === 'true' : undefined,
        sortBy: sortBy ? String(sortBy) : undefined,
        page: Number(page),
        limit: Number(limit),
      }, req.ip || 'unknown')

      return res.json({ ...result, status: 'success', code: 200 })
    }),
  }
}

export const { searchWorkersHandler, advancedSearch } = createSearchHandlers()

/**
 * GET /api/workers/:id/reputation
 * Get the on-chain reputation summary for a worker.
 *
 * Returns the worker's verified status, average rating, review count, and
 * Stellar contract id so the frontend can display trust signals without
 * requiring a live Stellar RPC call.
 *
 * @param req - Route param `id`.
 * @param res - JSON `{ data: ReputationSummary, status, code }`.
 */
export async function getReputation(req: Request, res: Response) {
  try {
    const data = await getWorkerReputation(req.params.id)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/**
 * POST /api/workers/:id/reputation/sync
 * Sync a worker's on-chain reputation data into the local database.
 *
 * Called by trusted back-end processes (e.g. a Stellar event listener) after
 * an on-chain reputation change. Requires `admin` role.
 *
 * Body: `{ avgRating: number, reviewCount: number, reputation: number }`
 *
 * @param req - Route param `id`. Body: `{ avgRating, reviewCount, reputation }`.
 * @param res - JSON `{ data: Worker, status, code }`.
 */
export async function syncReputation(req: Request, res: Response) {
  try {
    const { avgRating, reviewCount, reputation } = req.body as {
      avgRating: number
      reviewCount: number
      reputation: number
    }
    const data = await syncReputationToDb(req.params.id, avgRating, reviewCount, reputation)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
