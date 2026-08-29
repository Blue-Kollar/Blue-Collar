import { Router } from 'express'
import { listCategories, getCategory, createCategory, updateCategory, deleteCategory } from '../controllers/categories.js'
import { cacheMiddleware, CacheTTL } from '../middleware/cache.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.get('/', cacheMiddleware(CacheTTL.HOUR), listCategories)
router.get('/:id', cacheMiddleware(CacheTTL.HOUR), getCategory)

router.post('/', authenticate, authorize('admin'), createCategory)
router.put('/:id', authenticate, authorize('admin'), updateCategory)
router.delete('/:id', authenticate, authorize('admin'), deleteCategory)

export default router
