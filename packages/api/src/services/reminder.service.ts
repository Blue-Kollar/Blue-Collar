import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { Prisma } from '@prisma/client'
import { db } from '@/db.js'
import { logger } from '@/config/logger.js'
import { sendVerificationReminderEmail } from '@/mailer/index.js'
import { nowUtc, addUtcMs } from '@/utils/date.js'
import { config } from '@/config/config.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function generateVerificationToken(userId: string) {
  const raw = jwt.sign({ id: userId, purpose: 'email-verify' }, config.auth.jwtSecret, { expiresIn: '7d' })
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiry = addUtcMs(nowUtc(), 7 * DAY)
  return { raw, hash, expiry }
}

function generateUnsubscribeToken(userId: string) {
  return jwt.sign({ id: userId, purpose: 'unsubscribe-reminders' }, config.auth.jwtSecret, { expiresIn: '30d' })
}

/**
 * Run the verification reminder job:
 * - Send first reminder 24h after registration (reminderCount === 0)
 * - Send second reminder 7 days after registration (reminderCount === 1)
 * - Delete unverified accounts older than 30 days
 */
export async function runVerificationReminderJob() {
  const now = nowUtc()

  // --- First reminder: 24h after creation, not yet reminded ---
  const firstReminderCutoff = addUtcMs(now, -DAY)
  const firstBatch = await db.user.findMany({
    where: {
      verified: false,
      unsubscribedReminders: false,
      reminderCount: 0,
      createdAt: { lte: firstReminderCutoff },
    } as Prisma.UserWhereInput,
    select: { id: true, email: true, firstName: true },
  })

  for (const user of firstBatch) {
    try {
      const { raw, hash, expiry } = generateVerificationToken(user.id)
      await db.user.update({
        where: { id: user.id },
        data: { verificationToken: hash, verificationTokenExpiry: expiry, reminderCount: 1, reminderSentAt: now } as Prisma.UserUncheckedUpdateInput,
      })
      const unsubToken = generateUnsubscribeToken(user.id)
      await sendVerificationReminderEmail(user.email, user.firstName, raw, unsubToken)
      logger.info({ userId: user.id }, 'Sent first verification reminder')
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send first reminder')
    }
  }

  // --- Second reminder: 7 days after creation, already sent first reminder ---
  const secondReminderCutoff = addUtcMs(now, -7 * DAY)
  const secondBatch = await db.user.findMany({
    where: {
      verified: false,
      unsubscribedReminders: false,
      reminderCount: 1,
      createdAt: { lte: secondReminderCutoff },
    } as Prisma.UserWhereInput,
    select: { id: true, email: true, firstName: true },
  })

  for (const user of secondBatch) {
    try {
      const { raw, hash, expiry } = generateVerificationToken(user.id)
      await db.user.update({
        where: { id: user.id },
        data: { verificationToken: hash, verificationTokenExpiry: expiry, reminderCount: 2, reminderSentAt: now } as Prisma.UserUncheckedUpdateInput,
      })
      const unsubToken = generateUnsubscribeToken(user.id)
      await sendVerificationReminderEmail(user.email, user.firstName, raw, unsubToken)
      logger.info({ userId: user.id }, 'Sent second verification reminder')
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send second reminder')
    }
  }

  // --- Delete unverified accounts older than 30 days ---
  const deleteCutoff = addUtcMs(now, -30 * DAY)
  const deleted = await db.user.deleteMany({
    where: { verified: false, createdAt: { lte: deleteCutoff } },
  })
  if (deleted.count > 0) {
    logger.info({ count: deleted.count }, 'Deleted unverified accounts older than 30 days')
  }
}

/**
 * Start the scheduled job — runs every hour.
 */
export function startReminderScheduler() {
  // Run immediately on startup, then every hour
  runVerificationReminderJob().catch((err) => logger.error({ err }, 'Reminder job failed'))
  return setInterval(() => {
    runVerificationReminderJob().catch((err) => logger.error({ err }, 'Reminder job failed'))
  }, HOUR)
}
