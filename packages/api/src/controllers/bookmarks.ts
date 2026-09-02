import type { Request, Response } from 'express'

import * as bookmarkService from '../services/bookmark.service.js'
import { catchAsync } from '../utils/catchAsync.js'

/**
 * POST /api/workers/:id/bookmark
 * Toggle bookmark for the authenticated user on the given worker.
 */
export const toggleBookmark = catchAsync(async (req: Request, res: Response) => {
  const result = await bookmarkService.toggleBookmark(req.user!.id, req.params.id)
  return res.json({ data: result, status: 'success', code: 200 })
})

/**
 * GET /api/users/me/bookmarks
 * List the authenticated user's bookmarked workers (paginated).
 */
export const listMyBookmarks = catchAsync(async (req: Request, res: Response) => {
  const page = Number(req.query.page ?? 1)
  const limit = Number(req.query.limit ?? 20)
  const result = await bookmarkService.listBookmarks(req.user!.id, page, limit)
  return res.json({ ...result, status: 'success', code: 200 })
})
