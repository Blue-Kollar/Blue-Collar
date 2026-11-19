import { Router } from 'express';
import { validate } from '@/middleware/validate.js';
import {
  createBookingSchema,
  updateBookingSchema,
  cancelBookingSchema,
  createPaymentTipSchema,
  createPaymentEscrowSchema,
  createPaymentFeeSchema,
  createJobSchema,
  updateJobSchema,
  applyToJobSchema,
  createDisputeSchema,
  resolveDisputeSchema,
  createEscrowSchema,
  activateEscrowSchema,
  releaseEscrowSchema,
  cancelEscrowSchema,
  createReviewSchema,
  flagReviewSchema,
  moderateReviewSchema,
  requestVerificationSchema,
  reviewVerificationSchema,
  updateNotificationPreferencesSchema,
  createMessageSchema,
  adminBulkOperationSchema,
  createCategorySchema,
  updateCategorySchema,
  createPortfolioSchema,
  updatePortfolioSchema,
  applyReferralSchema,
  createSubscriptionSchema,
  updateSubscriptionSchema,
  webhookPayloadSchema,
  updateUserSchema,
  createUserSchema,
} from '@/validations/index.js';

import bookingsController from '@/controllers/bookings.controller.js';
import paymentsController from '@/controllers/payments.controller.js';
import jobsController from '@/controllers/jobs.controller.js';
import disputesController from '@/controllers/disputes.controller.js';
import escrowController from '@/controllers/escrow.controller.js';
import reviewsController from '@/controllers/reviews.controller.js';
import verificationsController from '@/controllers/verifications.controller.js';
import notificationsController from '@/controllers/notifications.controller.js';
import messagesController from '@/controllers/messages.controller.js';
import adminController from '@/controllers/admin.controller.js';
import categoriesController from '@/controllers/categories.controller.js';
import portfolioController from '@/controllers/portfolio.controller.js';
import referralsController from '@/controllers/referrals.controller.js';
import subscriptionsController from '@/controllers/subscriptions.controller.js';
import webhooksController from '@/controllers/webhooks.controller.js';
import usersController from '@/controllers/users.controller.js';

const router = Router();

// ---------------------------------------------------------------------------
// Bookings
// ---------------------------------------------------------------------------
router.get('/bookings', bookingsController.list);
router.get('/bookings/:id', bookingsController.getById);
router.post('/bookings', validate(createBookingSchema), bookingsController.create);
router.patch('/bookings/:id', validate(updateBookingSchema), bookingsController.update);
router.post('/bookings/:id/cancel', validate(cancelBookingSchema), bookingsController.cancel);

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------
router.get('/payments', paymentsController.list);
router.get('/payments/:id', paymentsController.getById);
router.post('/payments/tip', validate(createPaymentTipSchema), paymentsController.tip);
router.post('/payments/escrow', validate(createPaymentEscrowSchema), paymentsController.escrow);
router.post('/payments/fee', validate(createPaymentFeeSchema), paymentsController.fee);

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------
router.get('/jobs', jobsController.list);
router.get('/jobs/:id', jobsController.getById);
router.post('/jobs', validate(createJobSchema), jobsController.create);
router.patch('/jobs/:id', validate(updateJobSchema), jobsController.update);
router.post('/jobs/:id/apply', validate(applyToJobSchema), jobsController.apply);

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------
router.get('/disputes', disputesController.list);
router.get('/disputes/:id', disputesController.getById);
router.post('/disputes', validate(createDisputeSchema), disputesController.create);
router.post('/disputes/:id/resolve', validate(resolveDisputeSchema), disputesController.resolve);

// ---------------------------------------------------------------------------
// Escrow
// ---------------------------------------------------------------------------
router.get('/escrow', escrowController.list);
router.get('/escrow/:id', escrowController.getById);
router.post('/escrow', validate(createEscrowSchema), escrowController.create);
router.post('/escrow/:id/activate', validate(activateEscrowSchema), escrowController.activate);
router.post('/escrow/:id/release', validate(releaseEscrowSchema), escrowController.release);
router.post('/escrow/:id/cancel', validate(cancelEscrowSchema), escrowController.cancel);

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------
router.get('/reviews', reviewsController.list);
router.get('/reviews/:id', reviewsController.getById);
router.post('/reviews', validate(createReviewSchema), reviewsController.create);
router.post('/reviews/:id/flag', validate(flagReviewSchema), reviewsController.flag);
router.post('/reviews/:id/moderate', validate(moderateReviewSchema), reviewsController.moderate);

// ---------------------------------------------------------------------------
// Verifications
// ---------------------------------------------------------------------------
router.get('/verifications', verificationsController.list);
router.get('/verifications/:id', verificationsController.getById);
router.post('/verifications/request', validate(requestVerificationSchema), verificationsController.request);
router.post('/verifications/:id/review', validate(reviewVerificationSchema), verificationsController.review);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
router.get('/notifications', notificationsController.list);
router.get('/notifications/preferences', notificationsController.getPreferences);
router.put(
  '/notifications/preferences',
  validate(updateNotificationPreferencesSchema),
  notificationsController.updatePreferences,
);

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
router.get('/messages', messagesController.list);
router.get('/messages/:id', messagesController.getById);
router.post('/messages', validate(createMessageSchema), messagesController.create);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
router.get('/admin/users', adminController.listUsers);
router.post('/admin/bulk', validate(adminBulkOperationSchema), adminController.bulkOperation);

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
router.get('/categories', categoriesController.list);
router.get('/categories/:id', categoriesController.getById);
router.post('/categories', validate(createCategorySchema), categoriesController.create);
router.patch('/categories/:id', validate(updateCategorySchema), categoriesController.update);

// ---------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------
router.get('/portfolio', portfolioController.list);
router.get('/portfolio/:id', portfolioController.getById);
router.post('/portfolio', validate(createPortfolioSchema), portfolioController.create);
router.patch('/portfolio/:id', validate(updatePortfolioSchema), portfolioController.update);

// ---------------------------------------------------------------------------
// Referrals
// ---------------------------------------------------------------------------
router.get('/referrals', referralsController.list);
router.post('/referrals/apply', validate(applyReferralSchema), referralsController.apply);

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
router.get('/subscriptions', subscriptionsController.list);
router.get('/subscriptions/:id', subscriptionsController.getById);
router.post('/subscriptions', validate(createSubscriptionSchema), subscriptionsController.create);
router.patch('/subscriptions/:id', validate(updateSubscriptionSchema), subscriptionsController.update);

// ---------------------------------------------------------------------------
// Webhooks
// ---------------------------------------------------------------------------
router.post('/webhooks', validate(webhookPayloadSchema), webhooksController.handle);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
router.get('/users', usersController.list);
router.get('/users/:id', usersController.getById);
router.post('/users', validate(createUserSchema), usersController.create);
router.patch('/users/:id', validate(updateUserSchema), usersController.update);

export default router;