/**
 * Job Queue — Issue #775
 *
 * BullMQ-based queue definitions for all async background work.
 * Import the queue you need and add jobs with `queue.add(...)`.
 */

import { Queue, type JobsOptions } from 'bullmq'
import { redis } from '../config/redis.js'

// ── Shared BullMQ connection ──────────────────────────────────────────────────

const connection = { host: redis.options.host ?? 'localhost', port: redis.options.port ?? 6379 }

// ── Default job options ───────────────────────────────────────────────────────

const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2_000 },
  removeOnComplete: { age: 86_400, count: 1_000 }, // keep 24 h
  removeOnFail: { age: 7 * 86_400 },               // keep 7 days in DLQ
}

// ── Queue definitions ─────────────────────────────────────────────────────────

/** Email dispatch queue */
export const emailQueue = new Queue('email', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })

/** Push notification fan-out queue */
export const notificationQueue = new Queue('notification', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })

/** Stellar event indexing reconciliation queue */
export const indexerQueue = new Queue('indexer', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })

/** Storage TTL extension queue (prevents Prisma TTL expirations) */
export const ttlQueue = new Queue('ttl-extension', {
  connection,
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 5 },
})

/** Periodic cleanup queue (expired sessions, stale records) */
export const cleanupQueue = new Queue('cleanup', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })

/** Scheduled digest / reminder queue */
export const schedulerQueue = new Queue('scheduler', { connection, defaultJobOptions: DEFAULT_JOB_OPTIONS })

// ── Job type definitions ──────────────────────────────────────────────────────

export interface EmailJobData {
  to: string
  subject: string
  templateName: string
  context: Record<string, unknown>
  userId?: string
}

export interface NotificationJobData {
  userId: string
  type: string
  title: string
  message: string
  channels: ('email' | 'push' | 'inapp')[]
  href?: string
  data?: Record<string, string>
}

export interface IndexerJobData {
  ledger?: number
  contractId?: string
  forceResync?: boolean
}

export interface TtlJobData {
  model: 'worker' | 'user' | 'session'
  recordId: string
  newTtl: number
}

export interface CleanupJobData {
  target: 'expired_sessions' | 'orphaned_uploads' | 'stale_notifications'
  olderThanDays?: number
}

export interface SchedulerJobData {
  jobType: 'booking_reminder' | 'review_prompt' | 'weekly_digest'
  userId: string
  scheduledFor: string // ISO timestamp
  payload?: Record<string, unknown>
}

// ── Helper to add jobs safely ─────────────────────────────────────────────────

export async function enqueueEmail(data: EmailJobData, opts?: JobsOptions) {
  return emailQueue.add('send-email', data, opts)
}

export async function enqueueNotification(data: NotificationJobData, opts?: JobsOptions) {
  return notificationQueue.add('dispatch-notification', data, opts)
}

export async function enqueueScheduled(data: SchedulerJobData, delay?: number) {
  return schedulerQueue.add('scheduled-job', data, { delay, priority: 2 })
}
