import { Router } from 'express'
import {
  listNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
  deleteNotification,
  getPreferences,
  updatePreferences,
  dispatchMultiChannel,
  getDeliveryLog,
} from '@/controllers/notifications.js'
import { authenticate } from '@/middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', listNotifications)
router.get('/unread-count', getUnreadCount)
router.get('/preferences', getPreferences)
router.put('/preferences', updatePreferences)
router.post('/dispatch', dispatchMultiChannel)
router.get('/:notificationId/delivery-log', getDeliveryLog)
router.patch('/:id/read', markRead)
router.patch('/read-all', markAllRead)
router.delete('/:id', deleteNotification)

export default router
