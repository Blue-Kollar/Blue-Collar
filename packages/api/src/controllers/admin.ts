import type { Request, Response } from 'express'
import path from 'node:path'
import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'
import { catchAsync } from '../utils/catchAsync.js'
import { deleteImage } from '../utils/imageProcessor.js'

/**
 * List all workers (including inactive ones)
 * Admin-only endpoint
 */
export const listAllWorkers = catchAsync(async (req: Request, res: Response) => {
    const { category, page = '1', limit = '20' } = req.query

    const workers = await db.worker.findMany({
        where: {
            ...(category ? { categoryId: String(category) } : {}),
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        include: {
            category: true,
            curator: {
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                }
            }
        },
    })

    return res.json({ data: workers, status: 'success', code: 200 })
})

/**
 * Delete a worker by ID
 * Admin-only endpoint
 */
export const deleteWorker = catchAsync(async (req: Request, res: Response) => {
    const worker = await db.worker.findUnique({ where: { id: req.params.id } })

    if (!worker) {
        throw new AppError('Worker not found', 404)
    }

    // Delete avatar file if it exists
    if (worker.avatar) {
        const avatarPath = path.resolve(worker.avatar)
        deleteImage(avatarPath)
    }

    await db.worker.delete({ where: { id: req.params.id } })
    return res.status(204).send()
})

/**
 * Toggle worker activation status
 * Admin-only endpoint
 */
export const toggleWorkerActivation = catchAsync(async (req: Request, res: Response) => {
    const worker = await db.worker.findUnique({ where: { id: req.params.id } })

    if (!worker) {
        throw new AppError('Worker not found', 404)
    }

    const updated = await db.worker.update({
        where: { id: req.params.id },
        data: { isActive: !worker.isActive },
    })

    return res.json({ data: updated, status: 'success', code: 200 })
})

/**
 * Bulk delete workers by IDs
 * Admin-only endpoint
 */
export const bulkDeleteWorkers = catchAsync(async (req: Request, res: Response) => {
    const { ids } = req.body

    if (!Array.isArray(ids) || ids.length === 0) {
        throw new AppError('Invalid request: ids must be a non-empty array', 400)
    }

    // Fetch workers to delete their avatar files
    const workers = await db.worker.findMany({
        where: { id: { in: ids } },
        select: { id: true, avatar: true }
    })

    // Delete avatar files
    for (const worker of workers) {
        if (worker.avatar) {
            const avatarPath = path.resolve(worker.avatar)
            deleteImage(avatarPath)
        }
    }

    // Bulk delete workers
    const result = await db.worker.deleteMany({
        where: { id: { in: ids } }
    })

    return res.json({
        data: { deletedCount: result.count },
        status: 'success',
        message: `Successfully deleted ${result.count} worker(s)`,
        code: 200
    })
})

/**
 * List all users
 * Admin-only endpoint
 */
export const listAllUsers = catchAsync(async (req: Request, res: Response) => {
    const { role, page = '1', limit = '20' } = req.query

    const users = await db.user.findMany({
        where: {
            ...(role ? { role: role as any } : {}),
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            verified: true,
            walletAddress: true,
            avatar: true,
            phone: true,
            createdAt: true,
            updatedAt: true,
            // Exclude sensitive fields
            password: false,
            googleId: false,
            verificationToken: false,
            verificationTokenExpiry: false,
            resetToken: false,
            resetTokenExpiry: false,
        },
    })

    return res.json({ data: users, status: 'success', code: 200 })
})
