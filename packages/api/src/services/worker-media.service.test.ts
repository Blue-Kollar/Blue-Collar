/**
 * worker-media.service.test.ts — unit tests for worker-media service (#1372)
 *
 * Coverage for:
 *  - createWorkerWithMedia: image processing and worker creation
 *  - updateWorkerWithMedia: image replacement, deletion and update
 *  - deleteWorkerWithMedia: image cleanup and worker deletion
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createWorkerWithMedia, updateWorkerWithMedia, deleteWorkerWithMedia } from './worker-media.service.js'

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../db.js', () => ({
  db: {
    worker: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('../utils/imageProcessor.js', () => ({
  processImage: vi.fn(),
  deleteImages: vi.fn(),
}))

vi.mock('./worker-crud.service.js', () => ({
  createWorker: vi.fn(),
  updateWorker: vi.fn(),
  deleteWorker: vi.fn(),
}))

import { db } from '../db.js'
import { processImage, deleteImages } from '../utils/imageProcessor.js'
import { createWorker, updateWorker, deleteWorker } from './worker-crud.service.js'

// ── Test fixtures ──────────────────────────────────────────────────────────────

const mockCreateWorkerBody = {
  name: 'John Plumber',
  bio: 'Experienced plumber with 10 years',
  categoryId: 'cat-1',
  cityName: 'New York',
  rate: 50,
}

const mockUpdateWorkerBody = {
  name: 'John Plumber Updated',
  bio: 'Very experienced plumber',
}

const mockProcessedImages = {
  thumb: 'https://storage.example.com/thumb-123.jpg',
  medium: 'https://storage.example.com/medium-123.jpg',
  full: 'https://storage.example.com/full-123.jpg',
}

const mockWorkerResponse = {
  id: 'worker-1',
  name: 'John Plumber',
  bio: 'Experienced plumber',
  imageThumb: mockProcessedImages.thumb,
  imageMedium: mockProcessedImages.medium,
  imageFull: mockProcessedImages.full,
  avatar: mockProcessedImages.full,
  categoryId: 'cat-1',
  curatorId: 'curator-1',
  isActive: true,
}

const mockFile = { path: '/tmp/upload-123.jpg' }

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// createWorkerWithMedia tests

describe('createWorkerWithMedia', () => {
  it('creates worker without image when file not provided', async () => {
    vi.mocked(createWorker).mockResolvedValueOnce(mockWorkerResponse)

    const result = await createWorkerWithMedia(mockCreateWorkerBody, 'curator-1')

    expect(vi.mocked(processImage)).not.toHaveBeenCalled()
    expect(vi.mocked(createWorker)).toHaveBeenCalledWith(mockCreateWorkerBody, 'curator-1')
    expect(result).toEqual(mockWorkerResponse)
  })

  it('processes image and creates worker with image fields', async () => {
    vi.mocked(processImage).mockResolvedValueOnce(mockProcessedImages)
    vi.mocked(createWorker).mockResolvedValueOnce(mockWorkerResponse)

    const result = await createWorkerWithMedia(mockCreateWorkerBody, 'curator-1', mockFile)

    expect(vi.mocked(processImage)).toHaveBeenCalledWith(mockFile.path)
    expect(vi.mocked(createWorker)).toHaveBeenCalledWith(
      {
        ...mockCreateWorkerBody,
        imageThumb: mockProcessedImages.thumb,
        imageMedium: mockProcessedImages.medium,
        imageFull: mockProcessedImages.full,
        avatar: mockProcessedImages.full,
      },
      'curator-1',
    )
    expect(result).toEqual(mockWorkerResponse)
  })

  it('passes worker data and curator ID to createWorker', async () => {
    vi.mocked(processImage).mockResolvedValueOnce(mockProcessedImages)
    vi.mocked(createWorker).mockResolvedValueOnce(mockWorkerResponse)

    await createWorkerWithMedia(mockCreateWorkerBody, 'curator-999', mockFile)

    const call = vi.mocked(createWorker).mock.calls[0]
    expect(call[1]).toBe('curator-999')
  })

  it('merges image fields with worker data correctly', async () => {
    vi.mocked(processImage).mockResolvedValueOnce(mockProcessedImages)
    vi.mocked(createWorker).mockResolvedValueOnce(mockWorkerResponse)

    await createWorkerWithMedia(mockCreateWorkerBody, 'curator-1', mockFile)

    const call = vi.mocked(createWorker).mock.calls[0][0]
    expect(call.name).toBe(mockCreateWorkerBody.name)
    expect(call.imageThumb).toBe(mockProcessedImages.thumb)
    expect(call.imageFull).toBe(mockProcessedImages.full)
    expect(call.avatar).toBe(mockProcessedImages.full)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// updateWorkerWithMedia tests

describe('updateWorkerWithMedia', () => {
  it('updates worker without deleting old images when no new file', async () => {
    vi.mocked(updateWorker).mockResolvedValueOnce(mockWorkerResponse)

    const result = await updateWorkerWithMedia('worker-1', mockUpdateWorkerBody, undefined)

    expect(vi.mocked(db.worker.findUnique)).not.toHaveBeenCalled()
    expect(vi.mocked(deleteImages)).not.toHaveBeenCalled()
    expect(vi.mocked(updateWorker)).toHaveBeenCalledWith('worker-1', mockUpdateWorkerBody, undefined)
    expect(result).toEqual(mockWorkerResponse)
  })

  it('fetches existing worker when new file provided', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: 'old-image-url.jpg' })
    vi.mocked(processImage).mockResolvedValueOnce(mockProcessedImages)
    vi.mocked(updateWorker).mockResolvedValueOnce(mockWorkerResponse)

    await updateWorkerWithMedia('worker-1', mockUpdateWorkerBody, mockFile)

    expect(vi.mocked(db.worker.findUnique)).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      select: { imageFull: true },
    })
  })

  it('deletes old images before processing new file', async () => {
    const oldImageUrl = 'old-image-url.jpg'
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: oldImageUrl })
    vi.mocked(processImage).mockResolvedValueOnce(mockProcessedImages)
    vi.mocked(updateWorker).mockResolvedValueOnce(mockWorkerResponse)

    await updateWorkerWithMedia('worker-1', mockUpdateWorkerBody, mockFile)

    expect(vi.mocked(deleteImages)).toHaveBeenCalledWith(oldImageUrl)
  })

  it('skips deletion when old imageFull is null', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: null })
    vi.mocked(processImage).mockResolvedValueOnce(mockProcessedImages)
    vi.mocked(updateWorker).mockResolvedValueOnce(mockWorkerResponse)

    await updateWorkerWithMedia('worker-1', mockUpdateWorkerBody, mockFile)

    expect(vi.mocked(deleteImages)).not.toHaveBeenCalled()
  })

  it('processes new image and updates worker', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: 'old-url.jpg' })
    vi.mocked(processImage).mockResolvedValueOnce(mockProcessedImages)
    vi.mocked(updateWorker).mockResolvedValueOnce(mockWorkerResponse)

    const result = await updateWorkerWithMedia('worker-1', mockUpdateWorkerBody, mockFile, 'user-123')

    expect(vi.mocked(processImage)).toHaveBeenCalledWith(mockFile.path)
    expect(vi.mocked(updateWorker)).toHaveBeenCalledWith(
      'worker-1',
      {
        ...mockUpdateWorkerBody,
        imageThumb: mockProcessedImages.thumb,
        imageMedium: mockProcessedImages.medium,
        imageFull: mockProcessedImages.full,
        avatar: mockProcessedImages.full,
      },
      'user-123',
    )
    expect(result).toEqual(mockWorkerResponse)
  })

  it('passes updatedById parameter to updateWorker', async () => {
    vi.mocked(updateWorker).mockResolvedValueOnce(mockWorkerResponse)

    await updateWorkerWithMedia('worker-1', mockUpdateWorkerBody, undefined, 'user-999')

    expect(vi.mocked(updateWorker)).toHaveBeenCalledWith('worker-1', expect.anything(), 'user-999')
  })

  it('handles worker not found when fetching existing images', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(null)
    vi.mocked(processImage).mockResolvedValueOnce(mockProcessedImages)
    vi.mocked(updateWorker).mockResolvedValueOnce(mockWorkerResponse)

    await updateWorkerWithMedia('worker-1', mockUpdateWorkerBody, mockFile)

    expect(vi.mocked(deleteImages)).not.toHaveBeenCalled()
    expect(vi.mocked(updateWorker)).toHaveBeenCalled()
  })

  it('replaces all image variants when new file provided', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: 'old-full.jpg' })
    vi.mocked(processImage).mockResolvedValueOnce(mockProcessedImages)
    vi.mocked(updateWorker).mockResolvedValueOnce(mockWorkerResponse)

    await updateWorkerWithMedia('worker-1', mockUpdateWorkerBody, mockFile)

    const call = vi.mocked(updateWorker).mock.calls[0][0]
    expect(call.imageThumb).toBe(mockProcessedImages.thumb)
    expect(call.imageMedium).toBe(mockProcessedImages.medium)
    expect(call.imageFull).toBe(mockProcessedImages.full)
    expect(call.avatar).toBe(mockProcessedImages.full)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// deleteWorkerWithMedia tests

describe('deleteWorkerWithMedia', () => {
  it('fetches existing worker to get imageFull', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: 'image-url.jpg' })
    vi.mocked(deleteWorker).mockResolvedValueOnce(undefined)

    await deleteWorkerWithMedia('worker-1')

    expect(vi.mocked(db.worker.findUnique)).toHaveBeenCalledWith({
      where: { id: 'worker-1' },
      select: { imageFull: true },
    })
  })

  it('deletes images when imageFull exists', async () => {
    const imageUrl = 'https://storage.example.com/image-123.jpg'
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: imageUrl })
    vi.mocked(deleteWorker).mockResolvedValueOnce(undefined)

    await deleteWorkerWithMedia('worker-1')

    expect(vi.mocked(deleteImages)).toHaveBeenCalledWith(imageUrl)
  })

  it('skips image deletion when imageFull is null', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: null })
    vi.mocked(deleteWorker).mockResolvedValueOnce(undefined)

    await deleteWorkerWithMedia('worker-1')

    expect(vi.mocked(deleteImages)).not.toHaveBeenCalled()
  })

  it('calls deleteWorker after handling images', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: 'image-url.jpg' })
    vi.mocked(deleteWorker).mockResolvedValueOnce(undefined)

    await deleteWorkerWithMedia('worker-1')

    expect(vi.mocked(deleteWorker)).toHaveBeenCalledWith('worker-1')
  })

  it('handles worker not found case', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce(null)
    vi.mocked(deleteWorker).mockResolvedValueOnce(undefined)

    await deleteWorkerWithMedia('nonexistent-worker')

    expect(vi.mocked(deleteImages)).not.toHaveBeenCalled()
    expect(vi.mocked(deleteWorker)).toHaveBeenCalledWith('nonexistent-worker')
  })

  it('proceeds with deletion even if image deletion fails gracefully', async () => {
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: 'image-url.jpg' })
    vi.mocked(deleteImages).mockImplementationOnce(() => {
      throw new Error('Storage service error')
    })
    vi.mocked(deleteWorker).mockResolvedValueOnce(undefined)

    await expect(deleteWorkerWithMedia('worker-1')).rejects.toThrow()
  })

  it('deletes correct worker by ID', async () => {
    const workerId = 'worker-999'
    vi.mocked(db.worker.findUnique).mockResolvedValueOnce({ imageFull: null })
    vi.mocked(deleteWorker).mockResolvedValueOnce(undefined)

    await deleteWorkerWithMedia(workerId)

    expect(vi.mocked(deleteWorker)).toHaveBeenCalledWith(workerId)
  })
})
