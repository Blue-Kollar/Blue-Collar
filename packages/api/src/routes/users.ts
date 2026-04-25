import { Router } from 'express'
import { listMyBookmarks } from '../controllers/bookmarks.js'
import {
  updateProfile,
  changePassword,
  deleteAccount,
  savePushSubscription,
  deletePushSubscription,
} from '../controllers/users.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.patch('/me', authenticate, updateProfile)
router.put('/me/password', authenticate, changePassword)
router.delete('/me', authenticate, deleteAccount)
router.get('/me/bookmarks', authenticate, listMyBookmarks)
router.post('/me/push-subscription', authenticate, savePushSubscription)
router.delete('/me/push-subscription', authenticate, deletePushSubscription)

export default router
