import { Router } from 'express';
import {
  createSubscription,
  listSubscriptions,
  deleteSubscription,
  getLogs,
} from '@/controllers/webhooks.js';
import { authenticate } from '@/middleware/auth.js';
import { generalRateLimit } from '@/middleware/rate-limit.js';

const router = Router();

router.use(authenticate);
// Write routes are rate limited (#1817)
router.post('/', generalRateLimit, createSubscription);
router.get('/', listSubscriptions);
router.delete('/:id', generalRateLimit, deleteSubscription);
router.get('/:id/logs', getLogs);

export default router;
