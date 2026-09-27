/**
 * Purge service — #833
 *
 * Hard-deletes records that have been soft-deleted past the retention window,
 * and cleans up stale ancillary data (expired sessions, orphaned uploads, old
 * notifications).  All public methods are safe to call in isolation for testing.
 *
 * The scheduler.worker.ts delegates to `purgeService.*` (the default export).
 */
import path from 'node:path'
import fs from 'node:fs/promises'
import { db } from '../db.js'
import { logger } from '../config/logger.js'

// ── Constants ─────────────────────────────────────────────────────────────────

const NINETY_DAYS_MS  = 90 * 24 * 60 * 60 * 1000
const INTERVAL_MS     = 24 * 60 * 60 * 1000 // 24 hours

// ── Named helpers (tree-shakeable, easy to import in tests) ───────────────────

/**
 * Hard-delete Worker and User records whose `deletedAt` is older than 90 days.
 */
export async function purgeExpiredSoftDeletes(): Promise<void> {
  const cutoff = new Date(Date.now() - NINETY_DAYS_MS)

  const [workers, users] = await Promise.all([
    db.worker.deleteMany({ where: { deletedAt: { lte: cutoff } } }),
    db.user.deleteMany({ where: { deletedAt: { lte: cutoff } } }),
  ])

  if (workers.count > 0 || users.count > 0) {
    logger.info(
      { workers: workers.count, users: users.count },
      'Purged expired soft-deleted records',
    )
  }
}

/**
 * Remove expired refresh tokens (treated as "expired sessions").
 */
export async function deleteExpiredSessions(): Promise<void> {
  const result = await db.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lte: new Date() } },
        { revokedAt: { not: null, lte: new Date() } },
      ],
    },
  })
  if (result.count > 0) {
    logger.info({ count: result.count }, 'Purged expired refresh tokens / sessions')
  }
}

/**
 * Remove IdempotencyKey records that have passed their `expiresAt`.
 */
export async function deleteExpiredIdempotencyKeys(): Promise<void> {
  const result = await db.idempotencyKey.deleteMany({
    where: { expiresAt: { lte: new Date() } },
  })
  if (result.count > 0) {
    logger.info({ count: result.count }, 'Purged expired idempotency keys')
  }
}

/**
 * Delete uploaded files in the uploads directory that have no corresponding
 * Worker image reference.  "Orphaned" means the file is older than
 * `olderThanDays` days AND no Worker row references it.
 */
export async function deleteOrphanedUploads(olderThanDays = 30): Promise<void> {
  const uploadDir = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? 'storage/uploads')
  const cutoffMs = Date.now() - olderThanDays * 24 * 60 * 60 * 1000

  let entries: string[]
  try {
    entries = await fs.readdir(uploadDir)
  } catch {
    // Upload dir may not exist in test environments
    return
  }

  // Gather all image paths referenced by active Worker rows
  const referencedImages = await db.worker.findMany({
    where: {
      OR: [
        { imageFull:   { not: null } },
        { imageMedium: { not: null } },
        { imageThumb:  { not: null } },
      ],
    },
    select: { imageFull: true, imageMedium: true, imageThumb: true },
  })

  const referencedSet = new Set<string>()
  for (const w of referencedImages) {
    for (const url of [w.imageFull, w.imageMedium, w.imageThumb]) {
      if (url) referencedSet.add(path.basename(url))
    }
  }

  let purged = 0
  for (const entry of entries) {
    if (entry === '.gitkeep') continue
    const filePath = path.join(uploadDir, entry)
    try {
      const stat = await fs.stat(filePath)
      if (!stat.isFile()) continue
      if (stat.mtimeMs > cutoffMs) continue     // Too recent
      if (referencedSet.has(entry)) continue    // Still referenced

      await fs.unlink(filePath)
      purged++
    } catch {
      // Skip files we can't stat or delete
    }
  }

  if (purged > 0) {
    logger.info({ purged }, 'Purged orphaned upload files')
  }
}

/**
 * Delete Notification records older than `olderThanDays` days.
 */
export async function deleteOldNotifications(olderThanDays = 30): Promise<void> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000)
  const result = await db.notification.deleteMany({
    where: { createdAt: { lte: cutoff } },
  })
  if (result.count > 0) {
    logger.info({ count: result.count, olderThanDays }, 'Purged old notifications')
  }
}

// ── Service object (consumed by scheduler.worker.ts via named import) ─────────

export const purgeService = {
  deleteExpiredSessions,
  deleteOrphanedUploads,
  deleteOldNotifications,
  deleteExpiredIdempotencyKeys,
  purgeExpiredSoftDeletes,
} as const

// ── Scheduler ─────────────────────────────────────────────────────────────────

export function startPurgeScheduler(): void {
  // Run once at startup, then every 24 hours
  runAllPurges().catch((err) => logger.error(err, 'Initial purge run failed'))
  setInterval(() => {
    runAllPurges().catch((err) => logger.error(err, 'Purge job failed'))
  }, INTERVAL_MS)
}

async function runAllPurges() {
  await Promise.all([
    purgeExpiredSoftDeletes(),
    deleteExpiredSessions(),
    deleteExpiredIdempotencyKeys(),
  ])
}
