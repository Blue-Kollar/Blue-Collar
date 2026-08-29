import { bookmarkRepository as defaultBookmarkRepository } from '../repositories/bookmark.repository.js'
import { AppError } from './AppError.js'
import { updateBookmarkCount } from './analytics.service.js'
import type { BookmarkServiceDeps } from '../container/types.js'

// ── Factory ───────────────────────────────────────────────────────────────────

export function createBookmarkService(deps: BookmarkServiceDeps) {
  const { bookmarkRepository: repo } = deps

  return {
    /**
     * Toggle a bookmark for a user/worker pair.
     * Creates the bookmark if it doesn't exist, removes it if it does.
     * @returns `{ bookmarked: boolean }` — true if now bookmarked, false if removed
     */
    async toggleBookmark(userId: string, workerId: string) {
      const worker = await repo.findWorkerById(workerId)
      if (!worker) throw new AppError('Worker not found', 404)

      const existing = await repo.findByUserAndWorker(userId, workerId)

      if (existing) {
        await repo.deleteBookmark(existing.id)
        updateBookmarkCount(workerId, -1).catch(() => {})
        return { bookmarked: false }
      }

      await repo.createBookmark(userId, workerId)
      updateBookmarkCount(workerId, 1).catch(() => {})
      return { bookmarked: true }
    },

    /**
     * Return a paginated list of bookmarked workers for a user.
     */
    async listBookmarks(userId: string, page: number, limit: number) {
      const { data: bookmarks, total } = await repo.findUserBookmarks(userId, {
        skip: (page - 1) * limit,
        take: limit,
      })

      return {
        data: bookmarks.map((b: any) => b.worker),
        meta: { total, page, limit, pages: Math.ceil(total / limit) },
      }
    },
  }
}

// ── Default service instance (backward-compatible module-level API) ───────────

const _defaultService = createBookmarkService({
  bookmarkRepository: defaultBookmarkRepository,
})

/**
 * Toggle a bookmark for a user/worker pair.
 */
export async function toggleBookmark(userId: string, workerId: string) {
  return _defaultService.toggleBookmark(userId, workerId)
}

/**
 * Return a paginated list of bookmarked workers for a user.
 */
export async function listBookmarks(userId: string, page: number, limit: number) {
  return _defaultService.listBookmarks(userId, page, limit)
}
