import type { Request, Response } from 'express'
import * as workerService from '../services/worker.service.js'
import { handleError } from '../utils/handleError.js'
import { db } from '../db.js'
import { WorkerResource, WorkerCollection } from '../resources/index.js'
import type { CreateWorkerBody, UpdateWorkerBody, WorkerQuery } from '../interfaces/index.js'

/**
 * GET /api/workers
 * List active workers with optional filters and pagination.
 *
 * @param req - Query params: `category`, `page`, `limit`, `search`, `city`, `state`, `country`.
 * @param res - JSON `{ data: Worker[], meta, status, code }`.
 */
export async function listWorkers(req: Request<{}, {}, {}, WorkerQuery>, res: Response) {
  try {
    const { category, page = '1', limit = '20', search, city, state, country, minRating, available, listedSince } = req.query
    const { data, meta } = await workerService.listWorkers({
      category,
      page: Number(page),
      limit: Number(limit),
      search,
      city,
      state,
      country,
      minRating: minRating ? Number(minRating) : undefined,
      available: available !== undefined ? Number(available) : undefined,
      listedSince: listedSince ? Number(listedSince) : undefined,
    })
    return res.json({
      data: WorkerCollection(data as any),
      meta,
      status: 'success',
      code: 200
    })
  } catch (err) {
    return handleError(res, err)
  }
}

/**
 * GET /api/workers/:id
 * Get a single worker by id.
 *
 * @param req - Route param `id`.
 * @param res - JSON `{ data: Worker, status, code }` or 404.
 */
export async function showWorker(req: Request, res: Response) {
  try {
    const worker = await workerService.getWorker(req.params.id as string)
    if (!worker) {
      return res.status(404).json({ status: 'error', message: 'Worker not found', code: 404 })
    }
    return res.json({ data: WorkerResource(worker as any), status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
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
