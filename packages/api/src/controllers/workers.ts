import type { Request, Response } from 'express'
import * as workerService from '../services/worker.service.js'
import { handleError } from '../utils/handleError.js'
import { db } from '../db.js'
import { WorkerResource, WorkerCollection } from '../resources/index.js'
import type { CreateWorkerBody, UpdateWorkerBody, WorkerQuery } from '../interfaces/index.js'
import { invalidateCachePattern } from '../middleware/cache.js'

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

export async function listWorkers(req: Request, res: Response) {
  const { category, page = '1', limit = '20', lat, lng, radius } = req.query

  // Geo search: if lat/lng/radius provided, filter by proximity using Haversine
  if (lat && lng) {
    const userLat = Number(lat)
    const userLng = Number(lng)
    const radiusKm = radius ? Number(radius) : 10

    if (isNaN(userLat) || isNaN(userLng) || isNaN(radiusKm))
      return res.status(400).json({ status: 'error', message: 'Invalid lat, lng, or radius', code: 400 })

    // Bounding box pre-filter (1 degree ≈ 111 km)
    const delta = radiusKm / 111
    const workers = await db.worker.findMany({
      where: {
        isActive: true,
        latitude: { gte: userLat - delta, lte: userLat + delta },
        longitude: { gte: userLng - delta, lte: userLng + delta },
        ...(category ? { categoryId: String(category) } : {}),
      },
      include: { category: true },
    })

    const withDistance = workers
      .map(w => ({ ...w, distanceKm: haversine(userLat, userLng, w.latitude!, w.longitude!) }))
      .filter(w => w.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)

    const pageNum = Number(page)
    const limitNum = Number(limit)
    const paginated = withDistance.slice((pageNum - 1) * limitNum, pageNum * limitNum)
    return res.json({ data: paginated, status: 'success', code: 200 })
  }

  const workers = await db.worker.findMany({
    where: {
      isActive: true,
      ...(category ? { categoryId: String(category) } : {}),
    },
    skip: (Number(page) - 1) * Number(limit),
    take: Number(limit),
    include: { category: true },
  })
  return res.json({ data: workers, status: 'success', code: 200 })
}

/**
 * GET /api/workers/:id
 * Get a single worker by id.
 *
 * @param req - Route param `id`.
 * @param res - JSON `{ data: Worker, status, code }` or 404.
 */
export async function showWorker(req: Request, res: Response) {
  const worker = await db.worker.findUnique({
    where: { id: req.params.id },
    include: { category: true, portfolio: { orderBy: { order: 'asc' } } },
  })
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
    const worker = await workerService.createWorker(req.body, req.user!.id)
    return res.status(201).json({
      data: WorkerResource(worker as any),
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
 * @param req - Route param `id`. Body: `UpdateWorkerBody`.
 * @param res - JSON `{ data: Worker, status, code }`.
 */
export async function updateWorker(req: Request<{ id: string }, {}, UpdateWorkerBody>, res: Response) {
  try {
    const worker = await workerService.updateWorker(req.params.id, req.body)
    await invalidateCachePattern(`cache:*workers/${req.params.id}*`)
    await invalidateCachePattern(`cache:*workers?*`)
    return res.json({
      data: WorkerResource(worker as any),
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
    await workerService.deleteWorker(req.params.id as string)
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
      data: WorkerResource(updated as any),
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
  const curatorId = req.user!.id
  const where = { curatorId }
  const [workers, total] = await Promise.all([
    db.worker.findMany({
      where,
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    }),
    db.worker.count({ where }),
  ])
  return res.json({
    data: workers,
    meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) },
    status: 'success',
    code: 200,
  })
}
