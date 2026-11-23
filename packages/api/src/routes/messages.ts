import express from 'express';
import { authenticate } from '@/middleware/auth.js';
import * as messagesController from '@/controllers/messages.js';
import { generalRateLimit } from '@/middleware/rateLimit.js';

const router = express.Router();

router.use(authenticate);

router.get('/', messagesController.getConversations);
// Write routes are rate limited (#1817)
router.post('/', generalRateLimit, messagesController.createConversation);
router.get('/unread', messagesController.getUnreadCount);
router.get('/:conversationId', messagesController.getConversation);
router.put('/:conversationId/read', generalRateLimit, messagesController.markAsRead);
router.get('/:conversationId/search', messagesController.searchMessages);
router.delete('/:messageId', generalRateLimit, messagesController.deleteMessage);

export default router;
