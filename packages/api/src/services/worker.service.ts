import { db } from '../db.js'
import { AppError } from './AppError.js'
import { formatWorker } from '../models/worker.model.js'
import type { CreateWorkerBody, UpdateWorkerBody } from '../interfaces/index.js'

const workerInclude = { category: true, curator: true } as const

export async function listWorkers(opts: {
  category?: string
  page?: number
  limit?: number
  search?: string
  city?: string
  state?: string
  country?: string
}) {
  const { category, page = 1, limit = 20, search, city, state, country } = opts
  const where = {
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

export async function getWorker(id: string) {
  const worker = await db.worker.findUnique({ where: { id }, include: workerInclude })
  if (!worker) throw new AppError('Not found', 404)
  return formatWorker(worker)
}

export async function createWorker(data: CreateWorkerBody, curatorId: string) {
  const worker = await db.worker.create({
    data: { ...data, curatorId } as any,
    include: workerInclude,
  })
  return formatWorker(worker)
}

export async function updateWorker(id: string, data: UpdateWorkerBody) {
  const worker = await db.worker.update({
    where: { id },
    data: data as any,
    include: workerInclude,
  })
  return formatWorker(worker)
}

export async function deleteWorker(id: string) {
  await db.worker.delete({ where: { id } })
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
