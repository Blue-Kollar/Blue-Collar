import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import crypto from 'node:crypto'
import argon2 from 'argon2'
import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'

const ISSUER = 'BlueCollar'
const BACKUP_CODE_COUNT = 8

function generateBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODE_COUNT }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  )
}

/** Generate a new TOTP secret and return the otpauth URI + QR code data URL */
export async function setupTwoFactor(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('User not found', 404)
  if (user.twoFactorEnabled) throw new AppError('2FA is already enabled', 409)

  const secret = new OTPAuth.Secret()
  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })

  const uri = totp.toString()
  const qrCode = await QRCode.toDataURL(uri)

  // Store the secret (not yet enabled — user must verify first)
  await db.user.update({
    where: { id: userId },
    data: { twoFactorSecret: secret.base32 },
  })

  return { secret: secret.base32, uri, qrCode }
}

/** Verify a TOTP token and enable 2FA, returning backup codes */
export async function enableTwoFactor(userId: string, token: string) {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new AppError('User not found', 404)
  if (!user.twoFactorSecret) throw new AppError('2FA setup not initiated', 400)
  if (user.twoFactorEnabled) throw new AppError('2FA is already enabled', 409)

  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
  })

  const delta = totp.validate({ token, window: 1 })
  if (delta === null) throw new AppError('Invalid TOTP token', 400)

  const backupCodes = generateBackupCodes()
  const hashedCodes = await Promise.all(backupCodes.map(c => argon2.hash(c)))

  await db.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: true, twoFactorBackupCodes: hashedCodes },
  })

  return { backupCodes }
}

/** Verify a TOTP token during login */
export async function verifyTwoFactor(userId: string, token: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) return false

  const totp = new OTPAuth.TOTP({
    issuer: ISSUER,
    label: user.email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
  })

  return totp.validate({ token, window: 1 }) !== null
}

/** Verify a backup code (one-time use) */
export async function verifyBackupCode(userId: string, code: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !user.twoFactorEnabled) return false

  for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
    const match = await argon2.verify(user.twoFactorBackupCodes[i], code)
    if (match) {
      // Remove used backup code
      const remaining = [...user.twoFactorBackupCodes]
      remaining.splice(i, 1)
      await db.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: remaining } })
      return true
    }
  }
  return false
}

/** Disable 2FA — requires valid TOTP or backup code */
export async function disableTwoFactor(userId: string, token: string) {
  const valid = await verifyTwoFactor(userId, token)
  if (!valid) throw new AppError('Invalid TOTP token', 400)

  await db.user.update({
    where: { id: userId },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: [] },
  })
}

/** Regenerate backup codes — requires valid TOTP */
export async function regenerateBackupCodes(userId: string, token: string) {
  const valid = await verifyTwoFactor(userId, token)
  if (!valid) throw new AppError('Invalid TOTP token', 400)

  const backupCodes = generateBackupCodes()
  const hashedCodes = await Promise.all(backupCodes.map(c => argon2.hash(c)))

  await db.user.update({ where: { id: userId }, data: { twoFactorBackupCodes: hashedCodes } })
  return { backupCodes }
}
