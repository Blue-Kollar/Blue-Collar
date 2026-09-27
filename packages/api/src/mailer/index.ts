import { transporter } from './transport.js'
import { logger } from '../config/logger.js'
import { render } from './templateEngine.js'

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const FROM = `BlueCollar <${process.env.MAIL_USER}>`

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const html = render('verify-email.html', {
    name,
    verificationLink: `${APP_URL}/api/auth/verify-account?token=${token}`,
  })
  await transporter.sendMail({ from: FROM, to, subject: 'Verify your BlueCollar email', html })
}

/**
 * Nudges a user who registered but never verified their email. Distinct from
 * sendVerificationEmail's initial send: this variant includes an unsubscribe
 * link so recipients can opt out of further reminders.
 */
export async function sendVerificationReminderEmail(
  to: string,
  name: string,
  token: string,
  unsubscribeToken: string,
) {
  const html = render('verification-reminder.html', {
    name,
    verificationLink: `${APP_URL}/api/auth/verify-account?token=${token}`,
    unsubscribeLink: `${APP_URL}/api/notifications/unsubscribe?token=${unsubscribeToken}`,
  })
  await transporter.sendMail({ from: FROM, to, subject: 'Reminder: verify your BlueCollar email', html })
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const html = render('reset-password.html', {
    name,
    resetLink: `${APP_URL}/reset-password?token=${token}`,
  })
  await transporter.sendMail({ from: FROM, to, subject: 'Reset your BlueCollar password', html })
}

export async function sendWelcomeEmail(to: string, name: string) {
  const html = render('welcome.html', { name, appUrl: APP_URL })
  await transporter.sendMail({ from: FROM, to, subject: 'Welcome to BlueCollar 🎉', html })
}

// ── Generic notification ────────────────────────────────────────────────────
//
// sendContactRequestEmail, sendModerationEmail, sendInsuranceRenewalReminder,
// and sendVerificationStatusEmail previously each built their own one-off
// inline HTML string with the same "Hi {{name}}, <message> <cta>" shape.
// They now all render the shared notification.html template through this
// helper, so there's one place to update copy/branding instead of four.
async function sendNotificationEmail(options: {
  to: string
  subject: string
  name: string
  message: string
  extraHtml?: string
  ctaText?: string
  ctaLink?: string
}): Promise<void> {
  const html = render('notification.html', {
    subject: options.subject,
    name: options.name,
    message: options.message,
    extraHtml: options.extraHtml ?? '',
    ctaText: options.ctaText ?? 'View dashboard',
    ctaLink: options.ctaLink ?? `${APP_URL}/dashboard`,
  })
  const info = await transporter.sendMail({ from: FROM, to: options.to, subject: options.subject, html })

  // `options`/`message` are transport-implementation details (JSON dev-stub transport)
  // not part of nodemailer's public Transporter/SentMessageInfo types.
  const transporterOptions = (transporter as unknown as { options?: { jsonTransport?: boolean } }).options
  if (transporterOptions?.jsonTransport) {
    const devInfo = info as unknown as { message: string }
    logger.debug({ message: JSON.parse(devInfo.message) }, '[mailer] Notification email (dev stub)')
  }
}

export async function sendContactRequestEmail(to: string, workerName: string, fromUserName: string) {
  await sendNotificationEmail({
    to,
    subject: 'New contact request for your worker listing',
    name: 'there',
    message: `${fromUserName} has sent you a contact request for your ${workerName} listing.`,
    ctaText: 'View contact requests',
  })
}

export async function sendModerationEmail(
  to: string,
  firstName: string,
  status: 'approved' | 'rejected',
): Promise<void> {
  const action = status === 'approved' ? 'approved' : 'rejected'
  await sendNotificationEmail({
    to,
    subject: `Your review has been ${action}`,
    name: firstName,
    message: `Your review has been ${action} by our moderation team.`,
  })
}

export async function sendInsuranceRenewalReminder(to: string, workerName: string, expiresAt: Date) {
  await sendNotificationEmail({
    to,
    subject: `Insurance renewal required: ${workerName}`,
    name: 'there',
    message: `The insurance document for ${workerName} expires on ${expiresAt.toDateString()}. Please upload a renewed document to keep the worker's profile active.`,
    ctaText: 'Go to dashboard',
  })
}

export async function sendVerificationStatusEmail(
  to: string,
  firstName: string,
  workerName: string,
  status: 'approved' | 'rejected',
  reviewNote?: string,
) {
  const action = status === 'approved' ? 'approved ✅' : 'rejected ❌'
  const noteHtml = reviewNote ? `<p><strong>Note:</strong> ${reviewNote}</p>` : ''
  await sendNotificationEmail({
    to,
    subject: `Worker verification ${status}: ${workerName}`,
    name: firstName,
    message: `The verification request for ${workerName} has been ${action}.`,
    extraHtml: noteHtml,
    ctaText: 'View your dashboard',
  })
}
