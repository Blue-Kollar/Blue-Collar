import { Router } from 'express'

import { listMyBookmarks } from '../controllers/bookmarks.js'
import {
  changePassword,
  completeOnboarding,
  deleteAccount,
  deletePushSubscription,
  savePushSubscription,
  updateMe,
  updateProfile,
} from '../controllers/users.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.patch('/me', authenticate, updateProfile)
router.put('/me', authenticate, updateMe)
router.put('/me/password', authenticate, changePassword)
router.delete('/me', authenticate, deleteAccount)
router.get('/me/bookmarks', authenticate, listMyBookmarks)
router.post('/me/push-subscription', authenticate, savePushSubscription)
router.delete('/me/push-subscription', authenticate, deletePushSubscription)
router.post('/onboarding/complete', authenticate, completeOnboarding)

export default router
