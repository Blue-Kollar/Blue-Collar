import { db } from '../db.js'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { sendVerificationEmail, sendPasswordResetEmail } from '../mailer/index.js'
import { AppError } from './AppError.js'
import { sanitizeUser } from '../models/user.model.js'
import { logger } from '../config/logger.js'
import type { LoginBody, RegisterBody } from '../interfaces/index.js'

function generateVerificationToken(userId: string) {
  const raw = jwt.sign({ id: userId, purpose: 'email-verify' }, process.env.JWT_SECRET!, {
    expiresIn: '24h',
  })
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return { raw, hash, expiry }
}

export async function loginUser({ email, password }: LoginBody) {
  const user = await db.user.findUnique({ where: { email } })
  if (!user || !user.password || !(await argon2.verify(user.password, password))) {
    throw new AppError('Invalid credentials', 401)
  }
  if (!user.verified) {
    throw new AppError(
      'Your email address has not been verified. Please check your inbox and click the verification link.',
      403,
    )
  }
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  return { data: sanitizeUser(user), token }
}

export async function registerUser({ email, password, firstName, lastName }: RegisterBody) {
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) throw new AppError('Email already in use', 409)

  const hashed = await argon2.hash(password)
  const user = await db.user.create({ data: { email, password: hashed, firstName, lastName } })

  const { raw, hash, expiry } = generateVerificationToken(user.id)
  await db.user.update({
    where: { id: user.id },
    data: { verificationToken: hash, verificationTokenExpiry: expiry },
  })

  sendVerificationEmail(email, firstName, raw).catch((err) =>
    logger.error({ err }, 'Failed to send verification email'),
  )

  return sanitizeUser(user)
}

export async function verifyAccount(token: string): Promise<boolean> {
  let payload: { id?: string; purpose?: string }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; purpose: string }
  } catch {
    throw new AppError('Token is invalid or has expired', 400)
  }

  if (payload.purpose !== 'email-verify' || !payload.id) {
    throw new AppError('Invalid verification token', 400)
  }

  const user = await db.user.findUnique({ where: { id: payload.id } })
  if (!user) throw new AppError('User not found', 404)
  if (user.verified) return false

  const incomingHash = crypto.createHash('sha256').update(token).digest('hex')
  const valid =
    incomingHash === user.verificationToken &&
    user.verificationTokenExpiry &&
    user.verificationTokenExpiry > new Date()

  if (!valid) throw new AppError('Token is invalid or has expired', 400)

  await db.user.update({
    where: { id: user.id },
    data: { verified: true, verificationToken: null, verificationTokenExpiry: null },
  })
  return true
}

export async function requestPasswordReset(email: string) {
  const user = await db.user.findUnique({ where: { email } })
  if (!user) return

  const rawToken = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(rawToken).digest('hex')
  const expiry = new Date(Date.now() + 60 * 60 * 1000)

  await db.user.update({ where: { id: user.id }, data: { resetToken: hash, resetTokenExpiry: expiry } })

  sendPasswordResetEmail(user.email, user.firstName, rawToken).catch((err) =>
    logger.error({ err }, 'Failed to send password reset email'),
  )
}

export async function resetPassword(token: string, password: string) {
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  const user = await db.user.findFirst({
    where: { resetToken: hash, resetTokenExpiry: { gt: new Date() } },
  })
  if (!user) throw new AppError('Token is invalid or has expired', 400)

  const hashedPassword = await argon2.hash(password)
  await db.user.update({
    where: { id: user.id },
    data: { password: hashedPassword, resetToken: null, resetTokenExpiry: null },
  })
}
