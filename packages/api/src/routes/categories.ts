import { Router } from 'express'

import { publicReadRateLimiter } from '../config/rateLimiter.js'
import { createCategory, deleteCategory,getCategory, listCategories, updateCategory } from '../controllers/categories.js'
import { authenticate, authorize } from '../middleware/auth.js'
import { cacheMiddleware, CacheTTL } from '../middleware/cache.js'

const router = Router()

router.get('/', publicReadRateLimiter, cacheMiddleware(CacheTTL.HOUR), listCategories)
router.get('/:id', publicReadRateLimiter, cacheMiddleware(CacheTTL.HOUR), getCategory)

router.post('/', authenticate, authorize('admin'), createCategory)
router.put('/:id', authenticate, authorize('admin'), updateCategory)
router.delete('/:id', authenticate, authorize('admin'), deleteCategory)

export default router
