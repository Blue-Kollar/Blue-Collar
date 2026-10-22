import express from 'express'
import { authenticate } from '@/middleware/auth.js'
import * as messagesController from '@/controllers/messages.js'

const router = express.Router()

router.use(authenticate)

router.get('/', messagesController.getConversations)
router.post('/', messagesController.createConversation)
router.get('/unread', messagesController.getUnreadCount)
router.get('/:conversationId', messagesController.getConversation)
router.put('/:conversationId/read', messagesController.markAsRead)
router.get('/:conversationId/search', messagesController.searchMessages)
router.delete('/:messageId', messagesController.deleteMessage)

export default router
