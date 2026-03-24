import type { Request, Response } from 'express'
import { db } from '../db.js'
import argon2 from 'argon2'
import jwt from 'jsonwebtoken'
import crypto from 'node:crypto'
import { sendVerificationEmail } from '../mailer/index.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Sign a short-lived verification JWT and return both the raw token and its SHA-256 hash. */
function generateVerificationToken(userId: string): { raw: string; hash: string; expiry: Date } {
  const raw = jwt.sign({ id: userId, purpose: 'email-verify' }, process.env.JWT_SECRET!, {
    expiresIn: '24h',
  })
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return { raw, hash, expiry }
}

// ---------------------------------------------------------------------------
// Controllers
// ---------------------------------------------------------------------------

export async function login(req: Request, res: Response) {
  const { email, password } = req.body

  const user = await db.user.findUnique({ where: { email } })
  if (!user || !(await argon2.verify(user.password, password))) {
    return res.status(401).json({ status: 'error', message: 'Invalid credentials', code: 401 })
  }

  // Block login for unverified accounts
  if (!user.verified) {
    return res.status(403).json({
      status: 'error',
      message:
        'Your email address has not been verified. Please check your inbox and click the verification link.',
      code: 403,
    })
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  })
  const { password: _, verificationToken: __, verificationTokenExpiry: ___, ...data } = user
  return res.status(202).json({ data, status: 'success', message: 'Login successful', code: 202, token })
}

export async function register(req: Request, res: Response) {
  const { email, password, firstName, lastName } = req.body

  // Check for existing account before hashing
  const existing = await db.user.findUnique({ where: { email } })
  if (existing) {
    return res.status(409).json({ status: 'error', message: 'Email already in use', code: 409 })
  }

  const hashed = await argon2.hash(password)
  const user = await db.user.create({ data: { email, password: hashed, firstName, lastName } })

  // Generate verification token and persist its hash
  const { raw, hash, expiry } = generateVerificationToken(user.id)
  await db.user.update({
    where: { id: user.id },
    data: { verificationToken: hash, verificationTokenExpiry: expiry },
  })

  // Fire-and-forget the verification email (failures logged, not surfaced to client)
  sendVerificationEmail(email, firstName, raw).catch((err) =>
    console.error('[mailer] Failed to send verification email:', err),
  )

  const { password: _, verificationToken: __, verificationTokenExpiry: ___, ...data } = user
  return res.status(201).json({
    data,
    status: 'success',
    message: 'Registration successful. Please check your email to verify your account.',
    code: 201,
  })
}

export async function verifyAccount(req: Request, res: Response) {
  const token = (req.query.token ?? req.body.token) as string | undefined

  if (!token) {
    return res.status(400).json({ status: 'error', message: 'Verification token is required', code: 400 })
  }

  // Decode without verifying first so we can extract the user id
  let payload: { id?: string; purpose?: string }
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; purpose: string }
  } catch {
    return res.status(400).json({ status: 'error', message: 'Token is invalid or has expired', code: 400 })
  }

  if (payload.purpose !== 'email-verify' || !payload.id) {
    return res.status(400).json({ status: 'error', message: 'Invalid verification token', code: 400 })
  }

  const user = await db.user.findUnique({ where: { id: payload.id } })
  if (!user) {
    return res.status(404).json({ status: 'error', message: 'User not found', code: 404 })
  }

  if (user.verified) {
    return res.status(200).json({ status: 'success', message: 'Email already verified', code: 200 })
  }

  // Compare token hash
  const incomingHash = crypto.createHash('sha256').update(token).digest('hex')
  const tokenMatches = incomingHash === user.verificationToken
  const notExpired =
    user.verificationTokenExpiry && user.verificationTokenExpiry > new Date()

  if (!tokenMatches || !notExpired) {
    return res.status(400).json({ status: 'error', message: 'Token is invalid or has expired', code: 400 })
  }

  await db.user.update({
    where: { id: user.id },
    data: { verified: true, verificationToken: null, verificationTokenExpiry: null },
  })

  return res.status(200).json({ status: 'success', message: 'Email verified successfully', code: 200 })
}

export async function googleAuthCallback(req: Request, res: Response) {
  const user = req.user as any

  if (!user) {
    return res.redirect(`${process.env.APP_URL}/login?error=oauth-failed`)
  }

  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET!, {
    expiresIn: '7d',
  })

  // Redirect to frontend with token as query param
  return res.redirect(`${process.env.APP_URL}/auth-callback?token=${token}`)
}

export async function logout(_req: Request, res: Response) {
  return res.status(200).json({ status: 'success', message: 'Logged out', code: 200 })
}

export async function forgotPassword(req: Request, res: Response) {
  // TODO: send reset email
  return res.status(200).json({ status: 'success', message: 'Reset link sent if account exists', code: 200 })
}

export async function resetPassword(req: Request, res: Response) {
  // TODO: validate token and update password
  return res.status(200).json({ status: 'success', message: 'Password reset successful', code: 200 })
}
