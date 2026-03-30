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
