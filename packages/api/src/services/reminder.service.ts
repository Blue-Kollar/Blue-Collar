import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { db } from '../db.js'
import { logger } from '../config/logger.js'
import { sendVerificationReminderEmail } from '../mailer/index.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function generateVerificationToken(userId: string) {
  const raw = jwt.sign({ id: userId, purpose: 'email-verify' }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiry = new Date(Date.now() + 7 * DAY)
  return { raw, hash, expiry }
}

function generateUnsubscribeToken(userId: string) {
  return jwt.sign({ id: userId, purpose: 'unsubscribe-reminders' }, process.env.JWT_SECRET!, { expiresIn: '30d' })
}

/**
 * Run the verification reminder job:
 * - Send first reminder 24h after registration (reminderCount === 0)
 * - Send second reminder 7 days after registration (reminderCount === 1)
 * - Delete unverified accounts older than 30 days
 */
export async function runVerificationReminderJob() {
  const now = new Date()

  // --- First reminder: 24h after creation, not yet reminded ---
  const firstReminderCutoff = new Date(now.getTime() - DAY)
  const firstBatch = await db.user.findMany({
    where: {
      verified: false,
      unsubscribedReminders: false,
      reminderCount: 0,
      createdAt: { lte: firstReminderCutoff },
    },
    select: { id: true, email: true, firstName: true },
  })

  for (const user of firstBatch) {
    try {
      const { raw, hash, expiry } = generateVerificationToken(user.id)
      await db.user.update({
        where: { id: user.id },
        data: { verificationToken: hash, verificationTokenExpiry: expiry, reminderCount: 1, reminderSentAt: now },
      })
      const unsubToken = generateUnsubscribeToken(user.id)
      await sendVerificationReminderEmail(user.email, user.firstName, raw, unsubToken)
      logger.info({ userId: user.id }, 'Sent first verification reminder')
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send first reminder')
    }
  }

  // --- Second reminder: 7 days after creation, already sent first reminder ---
  const secondReminderCutoff = new Date(now.getTime() - 7 * DAY)
  const secondBatch = await db.user.findMany({
    where: {
      verified: false,
      unsubscribedReminders: false,
      reminderCount: 1,
      createdAt: { lte: secondReminderCutoff },
    },
    select: { id: true, email: true, firstName: true },
  })

  for (const user of secondBatch) {
    try {
      const { raw, hash, expiry } = generateVerificationToken(user.id)
      await db.user.update({
        where: { id: user.id },
        data: { verificationToken: hash, verificationTokenExpiry: expiry, reminderCount: 2, reminderSentAt: now },
      })
      const unsubToken = generateUnsubscribeToken(user.id)
      await sendVerificationReminderEmail(user.email, user.firstName, raw, unsubToken)
      logger.info({ userId: user.id }, 'Sent second verification reminder')
    } catch (err) {
      logger.error({ err, userId: user.id }, 'Failed to send second reminder')
    }
  }

  // --- Delete unverified accounts older than 30 days ---
  const deleteCutoff = new Date(now.getTime() - 30 * DAY)
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
