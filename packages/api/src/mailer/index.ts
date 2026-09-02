import { logger } from '../config/logger.js'
import { render } from './templateEngine.js'
import { transporter } from './transport.js'

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
  // `options`/`message` are transport-implementation details (JSON dev-stub transport)
  // not part of nodemailer's public Transporter/SentMessageInfo types.
  const transporterOptions = (transporter as unknown as { options?: { jsonTransport?: boolean } }).options
  if (transporterOptions?.jsonTransport) {
    const devInfo = info as unknown as { message: string }
    logger.debug({ message: JSON.parse(devInfo.message) }, '[mailer] Moderation email (dev stub)')
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
