import { Router } from 'express'
import multer from 'multer'
import {
  listPortfolio,
  addPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  reorderPortfolio,
} from '../controllers/portfolio.js'
import { authenticate, authorize } from '../middleware/auth.js'

const upload = multer({ dest: 'uploads/portfolio/' })
const router = Router({ mergeParams: true })

router.get('/', listPortfolio)
router.post('/', authenticate, authorize('curator', 'admin'), upload.single('image'), addPortfolioItem)
router.post('/:id', authenticate, authorize('curator', 'admin'), upload.single('image'), updatePortfolioItem) // method-spoofed PUT
router.delete('/:id', authenticate, authorize('curator', 'admin'), deletePortfolioItem)
router.patch('/reorder', authenticate, authorize('curator', 'admin'), reorderPortfolio)

export default router
