/**
 * Shared status constants.
 *
 * Kept in a dedicated module so validation schemas can import them without
 * creating a circular dependency through the package index.
 */

export const JobStatus = {
  Open: 'open',
  Closed: 'closed',
  Filled: 'filled',
  Expired: 'expired',
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export const JobUrgency = {
  Low: 'low',
  Normal: 'normal',
  Urgent: 'urgent',
} as const;
export type JobUrgency = (typeof JobUrgency)[keyof typeof JobUrgency];

export const ApplicationStatus = {
  Pending: 'pending',
  Accepted: 'accepted',
  Rejected: 'rejected',
  Withdrawn: 'withdrawn',
} as const;
export type ApplicationStatus = (typeof ApplicationStatus)[keyof typeof ApplicationStatus];

export const BookingStatus = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Cancelled: 'cancelled',
  Completed: 'completed',
} as const;
export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const TxStatusValue = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Failed: 'failed',
} as const;
export type TxStatusValue = (typeof TxStatusValue)[keyof typeof TxStatusValue];

