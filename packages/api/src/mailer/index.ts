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

export async function sendContactRequestEmail(to: string, workerName: string, fromUserName: string) {
  const html = `
    <p>Hi,</p>
    <p><strong>${fromUserName}</strong> has sent you a contact request for your <strong>${workerName}</strong> listing.</p>
    <p><a href="${APP_URL}/dashboard">View contact requests</a></p>
    <p>Best regards,<br>BlueCollar Team</p>
  `

  await transporter.sendMail({ from: FROM, to, subject: 'New contact request for your worker listing', html })
}

export async function sendModerationEmail(
  to: string,
  firstName: string,
  status: 'approved' | 'rejected',
): Promise<void> {
  const action = status === 'approved' ? 'approved' : 'rejected'
  const info = await transporter.sendMail({
    from: `"BlueCollar" <${process.env.MAIL_USER ?? 'noreply@bluecollar.app'}>`,
    to,
    subject: `Your review has been ${action}`,
    html: `<p>Hi <strong>${firstName}</strong>, your review has been <strong>${action}</strong> by our moderation team.</p>`,
  })
  // nodemailer's jsonTransport option is not part of the public type definitions;
  // we use it in dev/test to capture emails without a real SMTP server.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nodemailer jsonTransport internal option
  if ((transporter as any).options?.jsonTransport) {
    // nodemailer's jsonTransport stub exposes a non-standard `.message` string on the
    // returned SentMessageInfo. There is no official type for this internal property;
    // the cast is intentional and only executed in dev/test environments.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- nodemailer jsonTransport internal property
    logger.debug({ message: JSON.parse((info as any).message) }, '[mailer] Moderation email (dev stub)')
  }
}

export async function sendInsuranceRenewalReminder(to: string, workerName: string, expiresAt: Date) {
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Insurance renewal required: ${workerName}`,
    html: `<p>The insurance document for <strong>${workerName}</strong> expires on <strong>${expiresAt.toDateString()}</strong>.</p>
<p>Please upload a renewed document to keep the worker's profile active.</p>
<p><a href="${APP_URL}/dashboard">Go to dashboard</a></p>`,
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
  await transporter.sendMail({
    from: FROM,
    to,
    subject: `Worker verification ${status}: ${workerName}`,
    html: `<p>Hi <strong>${firstName}</strong>,</p>
<p>The verification request for <strong>${workerName}</strong> has been <strong>${action}</strong>.</p>
${noteHtml}
<p><a href="${APP_URL}/dashboard">View your dashboard</a></p>
<p>Best regards,<br>BlueCollar Team</p>`,
  })
}
