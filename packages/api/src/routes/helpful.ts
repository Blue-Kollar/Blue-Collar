import { Router } from 'express'

import { toggleHelpful } from '../controllers/helpful.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.post('/:reviewId/helpful', authenticate, toggleHelpful)

export default router
