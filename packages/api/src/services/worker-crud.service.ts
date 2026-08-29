import { db } from '../db.js'
import { AppError } from './AppError.js'
import { formatWorker } from '../models/worker.model.js'
import type { CreateWorkerBody, UpdateWorkerBody } from '../interfaces/index.js'
import { publishEvent } from './webhook.service.js'
import { appEvents } from '../events/app-events.js'
import { createServiceLogger } from '../utils/logger.js'

const logger = createServiceLogger('WorkerService')
const workerInclude = { category: true, curator: true } as const

export async function getWorker(id: string) {
  const worker = await db.worker.findUnique({ where: { id, deletedAt: null }, include: workerInclude })
  if (!worker) throw new AppError('Not found', 404)
  return formatWorker(worker)
}

export async function createWorker(data: CreateWorkerBody, curatorId: string) {
  logger.debug('Creating worker', { curatorId, name: data.name })
  const worker = await db.worker.create({
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
    data: { ...data as any, ...(updatedById ? { updatedById } : {}) },
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
 */
export async function getWorkerWithPortfolio(id: string) {
  return db.worker.findUnique({
    where: { id },
    include: { category: true, portfolio: { orderBy: { order: 'asc' } } },
  })
}
