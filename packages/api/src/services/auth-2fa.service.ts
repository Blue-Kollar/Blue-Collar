import * as OTPAuth from 'otpauth'
import crypto from 'node:crypto'
import { AppError } from '../utils/AppError.js'
import { userRepository as defaultUserRepository } from '../repositories/user.repository.js'

/**
 * Generate a new TOTP secret and QR code URL for 2FA enrollment.
 */
export async function generateTOTPSecret(userId: string) {
  const user = await defaultUserRepository.findById(userId)
  if (!user) throw new AppError('User not found', 404)
  if (user.twoFactorEnabled) throw new AppError('2FA is already enabled', 409)

  const secret = new OTPAuth.Secret({ size: 32 })
  const totp = new OTPAuth.TOTP({
    issuer: 'BlueCollar',
    label: `BlueCollar (${user.email})`,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  })

  return {
    secret: secret.base32,
    qrCode: totp.toString(),
  }
}

/**
 * Confirm and enable 2FA after verifying the initial TOTP code.
 */
export async function enableTwoFactorAuth(userId: string, totpCode: string, secret: string) {
  const user = await defaultUserRepository.findById(userId)
  if (!user) throw new AppError('User not found', 404)

  const totp = new OTPAuth.TOTP({
    issuer: 'BlueCollar',
    label: `BlueCollar (${user.email})`,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  })

  const isValid = totp.validate({ token: totpCode, window: 1 })
  if (!isValid) throw new AppError('Invalid TOTP code', 400)

  const backupCodes = Array.from({ length: 10 }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase(),
  )

  await defaultUserRepository.update(userId, {
    twoFactorSecret: secret,
    twoFactorEnabled: true,
    twoFactorBackupCodes: backupCodes,
  })

  return { backupCodes }
}

/**
 * Verify a TOTP code or backup code during 2FA login verification.
 */
export async function verifyTOTPCode(userId: string, code: string) {
  const user = await defaultUserRepository.findById(userId)
  if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
    throw new AppError('2FA not enabled for this user', 400)
  }

  if (user.twoFactorBackupCodes && user.twoFactorBackupCodes.includes(code)) {
    const updated = user.twoFactorBackupCodes.filter((c) => c !== code)
    await defaultUserRepository.update(userId, { twoFactorBackupCodes: updated })
    return true
  }

  const totp = new OTPAuth.TOTP({
    issuer: 'BlueCollar',
    label: `BlueCollar (${user.email})`,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(user.twoFactorSecret),
  })

  return !!totp.validate({ token: code, window: 1 })
}

/**
 * Disable 2FA for a user account.
 */
export async function disableTwoFactorAuth(userId: string) {
  await defaultUserRepository.update(userId, {
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: [],
  })
}
