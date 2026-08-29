/**
 * Dependency injection interfaces for BlueCollar API services.
 *
 * These interfaces decouple services from their concrete implementations,
 * making unit testing straightforward: tests inject plain mock objects instead
 * of relying on module-level vi.mock() patching.
 *
 * See docs/DI_PATTERN.md for the full pattern guide.
 */

import type { IAvailabilityRepository } from '../repositories/availability.repository.js'
import type { IBookmarkRepository } from '../repositories/bookmark.repository.js'
import type { IBookingRepository } from '../repositories/booking.repository.js'
import type { ICategoryRepository } from '../repositories/category.repository.js'
import type { IContactRequestRepository } from '../repositories/contact-request.repository.js'
import type { IDisputeRepository } from '../repositories/dispute.repository.js'
import type { IEscrowRepository } from '../repositories/escrow.repository.js'
import type { IInsuranceRepository } from '../repositories/insurance.repository.js'
import type { IJobRepository } from '../repositories/job.repository.js'
import type { IMessagingRepository } from '../repositories/messaging.repository.js'
import type { INotificationRepository } from '../repositories/notification.repository.js'
import type { IReferralRepository } from '../repositories/referral.repository.js'
import type { IReviewRepository } from '../repositories/review.repository.js'
import type { IUserRepository } from '../repositories/user.repository.js'
import type { IVerificationRepository } from '../repositories/verification.repository.js'
import type { IWalletRepository } from '../repositories/wallet.repository.js'
import type { StellarClient } from '../clients/stellar.client.js'

// ── Service dependency bags ───────────────────────────────────────────────────

/**
 * Dependencies injected into the category service factory.
 *
 * @example
 * ```ts
 * // Production (uses real Prisma repo)
 * import { categoryRepository } from '../repositories/category.repository.js'
 * const svc = createCategoryService({ categoryRepository })
 *
 * // Test (uses in-memory mock)
 * const mockRepo = { findAll: vi.fn().mockResolvedValue([]), findById: vi.fn(), ... }
 * const svc = createCategoryService({ categoryRepository: mockRepo })
 * ```
 */
export interface CategoryServiceDeps {
  categoryRepository: ICategoryRepository
}

/**
 * Dependencies injected into the user service factory.
 */
export interface UserServiceDeps {
  userRepository: IUserRepository
  mailer: IMailer
}

/**
 * Dependencies injected into the auth service factory.
 */
export interface AuthServiceDeps {
  userRepository: IUserRepository
  mailer: IMailer
  db: IDbClient
}

// ── New domain service deps ───────────────────────────────────────────────────

export interface JobServiceDeps {
  jobRepository: IJobRepository
}

export interface BookingServiceDeps {
  bookingRepository: IBookingRepository
}

export interface DisputeServiceDeps {
  disputeRepository: IDisputeRepository
}

export interface ReviewServiceDeps {
  reviewRepository: IReviewRepository
}

export interface MessagingServiceDeps {
  messagingRepository: IMessagingRepository
}

export interface NotificationServiceDeps {
  notificationRepository: INotificationRepository
}

export interface EscrowServiceDeps {
  escrowRepository: IEscrowRepository
}

export interface WalletServiceDeps {
  walletRepository?: IWalletRepository
  stellarClient?: StellarClient
}

export interface BookmarkServiceDeps {
  bookmarkRepository: IBookmarkRepository
}

export interface InsuranceServiceDeps {
  insuranceRepository: IInsuranceRepository
}

export interface ReferralServiceDeps {
  referralRepository: IReferralRepository
}

export interface VerificationServiceDeps {
  verificationRepository: IVerificationRepository
}

export interface ContactRequestServiceDeps {
  contactRequestRepository: IContactRequestRepository
}

export interface AvailabilityServiceDeps {
  availabilityRepository: IAvailabilityRepository
}

// ── Mailer interface ──────────────────────────────────────────────────────────

/** Minimal mailer interface used by auth and user services. */
export interface IMailer {
  sendVerificationEmail(to: string, name: string, token: string): Promise<void>
  sendPasswordResetEmail(to: string, name: string, token: string): Promise<void>
  sendWelcomeEmail?(to: string, name: string): Promise<void>
}

// ── Database client interface ─────────────────────────────────────────────────

/**
 * Minimal Prisma-client shape required by auth/user services.
 * Using generic args keeps this interface decoupled from the generated Prisma
 * client — tests can supply plain objects.
 */
export interface IDbClient {
  refreshToken: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create(args: any): Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findUnique(args: any): Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    update(args: any): Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateMany(args: any): Promise<any>
  }
  device: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create(args: any): Promise<any>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updateMany(args: any): Promise<any>
  }
}
