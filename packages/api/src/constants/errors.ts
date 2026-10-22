/**
 * Centralised error message constants.
 *
 * Use these instead of inline strings so that error copy is consistent
 * across controllers, middleware, and serializers, and easy to update
 * in one place.
 */
export const ErrorMessages = {
  // ── Generic ──────────────────────────────────────────────────────────────
  INTERNAL_SERVER_ERROR: 'Internal Server Error',
  NOT_FOUND: 'Not found',
  ROUTE_NOT_FOUND: (method: string, url: string) => `Route ${method} ${url} not found`,

  // ── Auth ─────────────────────────────────────────────────────────────────
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden: origin not allowed',
  TOKEN_REQUIRED: 'Token is required',
  TOKEN_INVALID: 'Invalid token',
  TOKEN_EXPIRED: 'Invalid or expired token',
  REFRESH_TOKEN_REQUIRED: 'refreshToken is required',
  VERIFICATION_TOKEN_REQUIRED: 'Verification token is required',

  // ── Users ────────────────────────────────────────────────────────────────
  USER_NOT_FOUND: 'User not found',
  FAILED_UPDATE_PROFILE: 'Failed to update profile',
  FAILED_CHANGE_PASSWORD: 'Failed to change password',
  FAILED_DELETE_ACCOUNT: 'Failed to delete account',
  FAILED_SAVE_SUBSCRIPTION: 'Failed to save subscription',
  FAILED_UNSUBSCRIBE: 'Failed to unsubscribe',
  FAILED_ONBOARDING: 'Failed to complete onboarding',
  CURRENT_PASSWORD_REQUIRED: 'currentPassword and newPassword are required',
  PASSWORD_TOO_SHORT: 'New password must be at least 8 characters',
  OAUTH_ACCOUNT_NO_PASSWORD: 'Cannot change password for OAuth accounts',
  CURRENT_PASSWORD_INCORRECT: 'Current password is incorrect',
  INVALID_PUSH_SUBSCRIPTION: 'Invalid subscription',
  ENDPOINT_REQUIRED: 'Endpoint required',

  // ── Workers ───────────────────────────────────────────────────────────────
  WORKER_NOT_FOUND: 'Worker not found',
  INVALID_GEO_PARAMS: 'Invalid lat, lng, or radius',

  // ── Categories ───────────────────────────────────────────────────────────
  CATEGORY_NOT_FOUND: 'Category not found',

  // ── Jobs ─────────────────────────────────────────────────────────────────
  WORKER_ID_REQUIRED: 'workerId is required',
  APPLICATION_STATUS_INVALID: 'status must be accepted or rejected',
  JOB_NOT_FOUND: 'Job not found',
  JOB_NOT_OPEN: 'Job is not accepting applications',
  JOB_ALREADY_APPLIED: 'Already applied to this job',
  JOB_CANNOT_WITHDRAW: 'Cannot withdraw a non-pending application',
  JOB_FORBIDDEN: 'You do not own this job',
  JOB_MESSAGE_RECIPIENT_REQUIRED: 'recipientId is required',
  JOB_NOT_RENEWABLE: 'Only open or expired jobs can be renewed',

  // ── Reviews ───────────────────────────────────────────────────────────────
  RATING_INVALID: 'rating must be 1-5',
  REVIEW_ACTION_INVALID: 'action must be approve or reject',

  // ── Payments ─────────────────────────────────────────────────────────────
  TIP_FIELDS_REQUIRED: 'from, to, and amount are required',
  ESCROW_FIELDS_REQUIRED: 'from, to, amount, and expiryDate are required',
  FEE_BPS_REQUIRED: 'fee_bps is required',

  // ── Verifications ─────────────────────────────────────────────────────────
  VERIFICATION_FIELDS_REQUIRED: 'workerId and documentUrl are required',
  VERIFICATION_STATUS_INVALID: 'status must be "approved" or "rejected"',

  // ── Subscriptions ─────────────────────────────────────────────────────────
  SUBSCRIPTION_NOT_FOUND: 'No subscription found',
  SUBSCRIPTION_TIER_INVALID: 'tier must be free, pro, or premium',

  // ── Admin ────────────────────────────────────────────────────────────────
  IDS_MUST_BE_NON_EMPTY_ARRAY: 'ids must be a non-empty array',
  ACTIVE_MUST_BE_BOOLEAN: 'active must be a boolean',

  // ── Database ─────────────────────────────────────────────────────────────
  DB_DUPLICATE_VALUE: 'A record with that value already exists',
  DB_RECORD_NOT_FOUND: 'Record not found',
  DB_RELATED_NOT_FOUND: 'Related record not found',
  DB_ERROR: 'Database error',
} as const

type ErrorMessage = (typeof ErrorMessages)[keyof typeof ErrorMessages]
