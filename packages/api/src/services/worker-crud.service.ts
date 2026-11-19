import type { Prisma } from '@prisma/client'
import { AppError } from '@/utils/app-error.js'
import { formatWorker } from '@/models/worker.model.js'
import type { CreateWorkerBody, UpdateWorkerBody } from '@/interfaces/index.js'
import { publishEvent } from './webhook.service.js'
import { appEvents } from '@/events/app-events.js'
import { createServiceLogger } from '@/utils/logger.js'
import { sanitizeFreeText } from '@/utils/sanitize.js'
import { nowUtc } from '@/utils/date.js'
import { workerRepository } from '@/repositories/worker.repository.js'

const logger = createServiceLogger('WorkerService')
const workerInclude = { category: true, curator: true } as const

function sanitizeWorkerText<T extends { name?: string; bio?: string | null }>(data: T): T {
  return {
    ...data,
    ...(data.name !== undefined ? { name: sanitizeFreeText(data.name) } : {}),
    ...(data.bio !== undefined ? { bio: data.bio === null ? null : sanitizeFreeText(data.bio) } : {}),
  }
}

export async function getWorker(id: string) {
  const worker = await workerRepository.findActiveById(id, workerInclude)
  if (!worker) throw new AppError('Not found', 404)
  return formatWorker(worker)
}

export async function createWorker(data: CreateWorkerBody, curatorId: string) {
  logger.debug('Creating worker', { curatorId, name: data.name })
  const sanitized = sanitizeWorkerText(data)
  const worker = await workerRepository.create(
    { ...sanitized, curatorId, createdById: curatorId, updatedById: curatorId } satisfies Prisma.WorkerUncheckedCreateInput,
    workerInclude,
  )
  publishEvent('worker.created', { worker: formatWorker(worker) }).catch(() => {})
  appEvents.emit('worker.created', { workerId: worker.id, curatorId })
  logger.info('Worker created successfully', { workerId: worker.id, curatorId })
  return formatWorker(worker)
}

export async function updateWorker(id: string, data: UpdateWorkerBody, updatedById?: string) {
  logger.debug('Updating worker', { workerId: id })
  const sanitized = sanitizeWorkerText(data)
  const worker = await workerRepository.update(
    id,
    { ...sanitized, ...(updatedById ? { updatedById } : {}) } satisfies Prisma.WorkerUncheckedUpdateInput,
    workerInclude,
  )
  publishEvent('worker.updated', { worker: formatWorker(worker) }).catch(() => {})
  appEvents.emit('worker.updated', { workerId: id, curatorId: worker.curatorId })
  logger.info('Worker updated successfully', { workerId: id })
  return formatWorker(worker)
}

export async function deleteWorker(id: string) {
  logger.debug('Deleting worker', { workerId: id })
  await workerRepository.softDelete(id, nowUtc())
  publishEvent('worker.deleted', { workerId: id }).catch(() => {})
  appEvents.emit('worker.deleted', { workerId: id })
  logger.info('Worker deleted successfully', { workerId: id })
}

export async function restoreWorker(id: string) {
  logger.debug('Restoring worker', { workerId: id })
  const worker = await workerRepository.findById(id)
  if (!worker) {
    logger.warn('Restore failed: worker not found', { workerId: id })
    throw new AppError('Not found', 404)
  }
  if (!worker.deletedAt) {
    logger.warn('Restore failed: worker is not deleted', { workerId: id })
    throw new AppError('Worker is not deleted', 400)
  }
  const restored = await workerRepository.restore(id, workerInclude)
  return formatWorker(restored)
}

export async function toggleWorker(id: string) {
  const worker = await workerRepository.findById(id)
  if (!worker) throw new AppError('Not found', 404)
  const updated = await workerRepository.update(id, { isActive: !worker.isActive }, workerInclude)
  appEvents.emit('worker.toggled', { workerId: id, isActive: updated.isActive })
  return formatWorker(updated)
}

/**
 * Get a single worker with its portfolio, ordered by `order`.
 */
export async function getWorkerWithPortfolio(id: string) {
  return workerRepository.findWithPortfolio(id)
}
