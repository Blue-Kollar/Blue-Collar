import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { transporter } from './transport.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadTemplate(name: string): string {
  return readFileSync(join(__dirname, 'templates', name), 'utf-8')
}

const APP_URL = process.env.APP_URL ?? 'http://localhost:3000'
const FROM = `BlueCollar <${process.env.MAIL_USER}>`

export async function sendVerificationEmail(to: string, name: string, token: string) {
  const html = loadTemplate('verify-email.html')
    .replace(/{{name}}/g, name)
    .replace(/{{verificationLink}}/g, `${APP_URL}/api/auth/verify-account?token=${token}`)

  await transporter.sendMail({ from: FROM, to, subject: 'Verify your BlueCollar email', html })
}

export async function sendPasswordResetEmail(to: string, name: string, token: string) {
  const html = loadTemplate('reset-password.html')
    .replace(/{{name}}/g, name)
    .replace(/{{resetLink}}/g, `${APP_URL}/reset-password?token=${token}`)

  await transporter.sendMail({ from: FROM, to, subject: 'Reset your BlueCollar password', html })
}

export async function sendWelcomeEmail(to: string, name: string) {
  const html = loadTemplate('welcome.html')
    .replace(/{{name}}/g, name)
    .replace(/{{appUrl}}/g, APP_URL)

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
  if ((transporter as any).options?.jsonTransport) {
    console.log('[mailer] Moderation email (dev stub):', JSON.parse((info as any).message))
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
