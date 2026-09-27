import { Router } from 'express'
import { listMyBookmarks } from '../controllers/bookmarks.js'
import {
  updateProfile,
  updateMe,
  changePassword,
  deleteAccount,
  savePushSubscription,
  deletePushSubscription,
  completeOnboarding,
} from '../controllers/users.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  updateProfileRules,
  changePasswordRules,
  pushSubscriptionRules,
  deletePushSubscriptionRules,
  completeOnboardingRules,
} from '../validations/index.js'

const router = Router()

router.patch('/me', authenticate, validate(updateProfileRules), updateProfile)
router.put('/me', authenticate, validate(updateProfileRules), updateMe)
router.put('/me/password', authenticate, validate(changePasswordRules), changePassword)
router.delete('/me', authenticate, deleteAccount)
router.get('/me/bookmarks', authenticate, listMyBookmarks)
router.post('/me/push-subscription', authenticate, validate(pushSubscriptionRules), savePushSubscription)
router.delete('/me/push-subscription', authenticate, validate(deletePushSubscriptionRules, 'body'), deletePushSubscription)
router.post('/onboarding/complete', authenticate, validate(completeOnboardingRules), completeOnboarding)

export default router
