import { Router } from 'express'
import { listCategories, getCategory, createCategory, updateCategory, deleteCategory } from '../controllers/categories.js'
import { cacheMiddleware, CacheTTL } from '../middleware/cache.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { publicReadRateLimiter } from '../config/rateLimiter.js'

const router = Router()

router.get('/', publicReadRateLimiter, cacheMiddleware(CacheTTL.HOUR), listCategories)
router.get('/:id', publicReadRateLimiter, cacheMiddleware(CacheTTL.HOUR), getCategory)

router.post('/', authenticate, authorize('admin'), createCategory)
router.put('/:id', authenticate, authorize('admin'), updateCategory)
router.delete('/:id', authenticate, authorize('admin'), deleteCategory)

export default router
