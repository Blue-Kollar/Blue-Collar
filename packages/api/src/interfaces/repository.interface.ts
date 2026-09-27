/**
 * Repository interfaces — Issue #1354
 *
 * Centralizes the repository contracts consumed by more than one service
 * (userRepository is wired into auth.service, auth-2fa.service, and
 * user.service) plus the other core domain repositories, under interfaces/
 * so services and the container depend on these contracts rather than
 * importing concrete Prisma-backed classes directly.
 *
 * The interfaces themselves are still declared next to their Prisma
 * implementation (repositories/*.repository.ts) to stay next to the class
 * that implements them; this module just re-exports them from a stable,
 * implementation-agnostic path that services/container.ts import from.
 */

export type { IRepository } from '../repositories/base.repository.js'
export type { IUserRepository } from '../repositories/user.repository.js'
export type { IJobRepository } from '../repositories/job.repository.js'
export type { IBookingRepository, BookingSlot } from '../repositories/booking.repository.js'
