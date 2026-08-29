import { db } from '../db.js'
import type { CreateWorkerBody, UpdateWorkerBody } from '../interfaces/index.js'
import { processImage, deleteImages } from '../utils/imageProcessor.js'
import { createWorker, updateWorker, deleteWorker } from './worker-crud.service.js'

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
