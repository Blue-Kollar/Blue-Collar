/**
 * Lightweight dependency injection container for BlueCollar API.
 *
 * Re-exports the service factory types and provides convenience re-exports.
 * Each service module exposes its own `createXxxService(deps)` factory.
 *
 * ## Pattern summary
 *
 * Every service module exports:
 *   1. A `createXxxService(deps)` factory that returns a bound service object.
 *   2. Module-level function exports that delegate to a default instance wired
 *      with real production dependencies — this keeps all existing controller
 *      imports working unchanged.
 *
 * ## Usage in tests (DI — no vi.mock needed)
 * ```ts
 * import { createCategoryService } from '../services/category.service.js'
 *
 * const mockRepo = {
 *   findAll: vi.fn().mockResolvedValue([]),
 *   findById: vi.fn(),
 *   findByName: vi.fn(),
 *   create: vi.fn(),
 *   update: vi.fn(),
 *   delete: vi.fn(),
 *   count: vi.fn(),
 * }
 * const svc = createCategoryService({ categoryRepository: mockRepo })
 * const result = await svc.listCategories()
 * expect(mockRepo.findAll).toHaveBeenCalledOnce()
 * ```
 *
 * See docs/DI_PATTERN.md for the full guide and examples for every service.
 */

export type {
  CategoryServiceDeps,
  UserServiceDeps,
  AuthServiceDeps,
  JobServiceDeps,
  BookingServiceDeps,
  DisputeServiceDeps,
  ReviewServiceDeps,
  MessagingServiceDeps,
  NotificationServiceDeps,
  EscrowServiceDeps,
  WalletServiceDeps,
  BookmarkServiceDeps,
  InsuranceServiceDeps,
  ReferralServiceDeps,
  VerificationServiceDeps,
  ContactRequestServiceDeps,
  AvailabilityServiceDeps,
  IMailer,
  IDbClient,
} from './types.js'

export { createCategoryService } from '../services/category.service.js'
export { createUserService } from '../services/user.service.js'
export { createAuthService } from '../services/auth.service.js'
export { createJobService } from '../services/job.service.js'
export { createBookingService } from '../services/booking.service.js'
export { createDisputeService } from '../services/dispute.service.js'
export { createReviewService } from '../services/review.service.js'
export { createMessagingService } from '../services/messaging.service.js'
export { createNotificationService } from '../services/notification.service.js'
export { createEscrowService } from '../services/escrow.service.js'
export { createWalletService } from '../services/wallet.service.js'
export { createBookmarkService } from '../services/bookmark.service.js'
export { createInsuranceService } from '../services/insurance.service.js'
export { createReferralService } from '../services/referral.service.js'
export { createVerificationService } from '../services/verification.service.js'
export { createContactRequestService } from '../services/contact-request.service.js'
export { createAvailabilityService } from '../services/availability.service.js'
