import { db } from '../db.js'
import { AppError } from './AppError.js'
import { formatWorker } from '../models/worker.model.js'
import type { CreateWorkerBody, UpdateWorkerBody } from '../interfaces/index.js'

const workerInclude = { category: true, curator: true } as const

/**
 * List active workers with optional filters and pagination.
 *
 * @param opts.category - Filter by category id.
 * @param opts.page - Page number (1-based, default 1).
 * @param opts.limit - Items per page (default 20).
 * @param opts.search - Full-text search on `name` and `bio`.
 * @param opts.city - Filter by location city (case-insensitive).
 * @param opts.state - Filter by location state (case-insensitive).
 * @param opts.country - Filter by location country (case-insensitive).
 * @returns Paginated `{ data, meta }`.
 */
export async function listWorkers(opts: {
  category?: string
  page?: number
  limit?: number
  search?: string
  city?: string
  state?: string
  country?: string
  minRating?: number
  available?: number
  listedSince?: number
}) {
  const { category, page = 1, limit = 20, search, city, state, country, minRating, available, listedSince } = opts

  const where: any = {
    isActive: true,
    ...(category ? { categoryId: category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { bio: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
    ...(city || state || country
      ? {
          location: {
            ...(city ? { city: { contains: city, mode: 'insensitive' as const } } : {}),
            ...(state ? { state: { contains: state, mode: 'insensitive' as const } } : {}),
            ...(country ? { country: { contains: country, mode: 'insensitive' as const } } : {}),
          },
        }
      : {}),
    ...(available !== undefined
      ? { availability: { some: { dayOfWeek: available } } }
      : {}),
    ...(listedSince !== undefined
      ? { createdAt: { gte: new Date(Date.now() - listedSince * 365 * 24 * 60 * 60 * 1000) } }
      : {}),
  }

  if (minRating !== undefined) {
    const qualifiedIds = await db.review.groupBy({
      by: ['workerId'],
      _avg: { rating: true },
      having: { rating: { _avg: { gte: minRating } } },
    })
    where.id = { in: qualifiedIds.map((r) => r.workerId) }
  }

  const [data, total] = await Promise.all([
    db.worker.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: workerInclude,
    }),
    db.worker.count({ where }),
  ])

  return {
    data: data.map(formatWorker),
    meta: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    },
  }
}

/**
 * Get a single worker by id.
 *
 * @param id - The worker's database id.
 * @returns The formatted worker object.
 * @throws AppError 404 if no worker exists with the given id.
 */
export async function getWorker(id: string) {
  const worker = await db.worker.findUnique({ where: { id }, include: workerInclude })
  if (!worker) throw new AppError('Not found', 404)
  return formatWorker(worker)
}

/**
 * Create a new worker listing.
 *
 * @param data - Worker fields from the request body.
 * @param curatorId - The id of the authenticated curator creating the listing.
 * @returns The newly created formatted worker.
 */
export async function createWorker(data: CreateWorkerBody, curatorId: string) {
  const worker = await db.worker.create({
    data: { ...data, curatorId } as any,
    include: workerInclude,
  })
  return formatWorker(worker)
}

/**
 * Update an existing worker listing.
 *
 * @param id - The worker's database id.
 * @param data - Fields to update.
 * @returns The updated formatted worker.
 */
export async function updateWorker(id: string, data: UpdateWorkerBody) {
  const worker = await db.worker.update({
    where: { id },
    data: data as any,
    include: workerInclude,
  })
  return formatWorker(worker)
}

/**
 * Permanently delete a worker listing.
 *
 * @param id - The worker's database id.
 */
export async function deleteWorker(id: string) {
  await db.worker.delete({ where: { id } })
}

/**
 * Toggle a worker's `isActive` status.
 *
 * @param id - The worker's database id.
 * @returns The updated formatted worker.
 * @throws AppError 404 if no worker exists with the given id.
 */
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
