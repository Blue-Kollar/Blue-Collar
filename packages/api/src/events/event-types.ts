/**
 * All application event names and their payload types.
 * Add new events here to keep the system type-safe.
 */
export interface AppEvents {
  // Worker lifecycle
  'worker.created':  { workerId: string; curatorId: string }
  'worker.updated':  { workerId: string; curatorId: string }
  'worker.deleted':  { workerId: string }
  'worker.toggled':  { workerId: string; isActive: boolean }

  // User lifecycle
  'user.registered': { userId: string; email: string }
  'user.verified':   { userId: string }
  'user.login':      { userId: string }

  // Reviews
  'review.created':  { reviewId: string; workerId: string; authorId: string; rating: number }

  // Payments
  'payment.completed': { fromUserId: string; toWorkerId: string; amount: number; token: string }
  'fee.taken':         { fee: number; recipient: string }

  // Jobs
  'job.created':     { jobId: string; postedById: string }
  'job.applied':     { jobId: string; workerId: string }
}

export type AppEventName = keyof AppEvents
