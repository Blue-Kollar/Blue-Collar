import type { Request, Response, NextFunction, RequestHandler } from 'express'

/**
 * Wrapper utility for async route handlers to catch promise rejections
 * and forward them to Express error handling middleware.
 * 
 * Usage:
 *   router.get('/users', catchAsync(async (req, res) => {
 *     const users = await db.user.findMany()
 *     res.json(users)
 *   }))
 */
export const catchAsync = (fn: RequestHandler) => {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next)
    }
}
