import express from 'express'

import * as messagesController from '../controllers/messages.js'
import { authenticate } from '../middleware/auth.js'

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
