/**
 * Unit tests for the 2FA enable and verify flows — issue #1579.
 * The user repository is mocked; TOTP codes are generated with otpauth so the
 * real validation path runs.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as OTPAuth from 'otpauth'
import {
  generateTOTPSecret,
  enableTwoFactorAuth,
  verifyTOTPCode,
  disableTwoFactorAuth,
} from './auth-2fa.service.js'
import { userRepository } from '@/repositories/user.repository.js'
import { AppError } from '@/utils/app-error.js'

vi.mock('@/repositories/user.repository.js', () => ({
  userRepository: {
    findById: vi.fn(),
    update: vi.fn(),
  },
}))

const findById = vi.mocked(userRepository.findById)
const update = vi.mocked(userRepository.update)

const USER_ID = 'user-1'
const EMAIL = 'worker@example.com'

function totpFor(base32Secret: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: 'BlueCollar',
    label: `BlueCollar (${EMAIL})`,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(base32Secret),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  update.mockResolvedValue({} as never)
})

describe('generateTOTPSecret', () => {
  it('throws 404 when the user does not exist', async () => {
    findById.mockResolvedValue(null)
    await expect(generateTOTPSecret(USER_ID)).rejects.toMatchObject({ statusCode: 404 })
  })

  it('throws 409 when 2FA is already enabled', async () => {
    findById.mockResolvedValue({ id: USER_ID, email: EMAIL, twoFactorEnabled: true } as never)
    await expect(generateTOTPSecret(USER_ID)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('returns a base32 secret and an otpauth URI for enrollment', async () => {
    findById.mockResolvedValue({ id: USER_ID, email: EMAIL, twoFactorEnabled: false } as never)

    const { secret, qrCode } = await generateTOTPSecret(USER_ID)

    expect(secret).toMatch(/^[A-Z2-7]+=*$/)
    expect(qrCode.startsWith('otpauth://totp/')).toBe(true)
    expect(qrCode).toContain(`secret=${secret}`)
    expect(qrCode).toContain('issuer=BlueCollar')
  })
})

describe('enableTwoFactorAuth', () => {
  it('throws 404 when the user does not exist', async () => {
    findById.mockResolvedValue(null)
    await expect(enableTwoFactorAuth(USER_ID, '123456', 'JBSWY3DPEHPK3PXP')).rejects.toBeInstanceOf(AppError)
    expect(update).not.toHaveBeenCalled()
  })

  it('rejects an invalid TOTP code with 400 and does not persist anything', async () => {
    const { secret } = await generateSecretFor()
    findById.mockResolvedValue({ id: USER_ID, email: EMAIL } as never)

    await expect(enableTwoFactorAuth(USER_ID, '000000', secret)).rejects.toMatchObject({ statusCode: 400 })
    expect(update).not.toHaveBeenCalled()
  })

  it('enables 2FA with the secret and returns 10 backup codes on a valid code', async () => {
    const { secret } = await generateSecretFor()
    findById.mockResolvedValue({ id: USER_ID, email: EMAIL } as never)
    const validCode = totpFor(secret).generate()

    const { backupCodes } = await enableTwoFactorAuth(USER_ID, validCode, secret)

    expect(backupCodes).toHaveLength(10)
    expect(backupCodes.every((c) => /^[0-9A-F]{8}$/.test(c))).toBe(true)
    expect(update).toHaveBeenCalledWith(USER_ID, {
      twoFactorSecret: secret,
      twoFactorEnabled: true,
      twoFactorBackupCodes: backupCodes,
    })
  })
})

describe('verifyTOTPCode', () => {
  it('throws 400 when 2FA is not enabled for the user', async () => {
    findById.mockResolvedValue({ id: USER_ID, email: EMAIL, twoFactorEnabled: false } as never)
    await expect(verifyTOTPCode(USER_ID, '123456')).rejects.toMatchObject({ statusCode: 400 })
  })

  it('returns true for a valid TOTP code', async () => {
    const { secret } = await generateSecretFor()
    findById.mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: [],
    } as never)

    await expect(verifyTOTPCode(USER_ID, totpFor(secret).generate())).resolves.toBe(true)
    expect(update).not.toHaveBeenCalled()
  })

  it('returns false for a wrong TOTP code', async () => {
    const { secret } = await generateSecretFor()
    findById.mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: [],
    } as never)

    await expect(verifyTOTPCode(USER_ID, '000000')).resolves.toBe(false)
  })

  it('accepts a backup code and removes only that code from the user', async () => {
    const { secret } = await generateSecretFor()
    findById.mockResolvedValue({
      id: USER_ID,
      email: EMAIL,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
      twoFactorBackupCodes: ['AAAA1111', 'BBBB2222'],
    } as never)

    await expect(verifyTOTPCode(USER_ID, 'AAAA1111')).resolves.toBe(true)
    expect(update).toHaveBeenCalledWith(USER_ID, { twoFactorBackupCodes: ['BBBB2222'] })
  })
})

describe('disableTwoFactorAuth', () => {
  it('clears the secret, backup codes and enabled flag', async () => {
    await disableTwoFactorAuth(USER_ID)
    expect(update).toHaveBeenCalledWith(USER_ID, {
      twoFactorEnabled: false,
      twoFactorSecret: null,
      twoFactorBackupCodes: [],
    })
  })
})

/** Produces a real enrollment secret by running the enrollment step with a stub user. */
async function generateSecretFor(): Promise<{ secret: string }> {
  findById.mockResolvedValueOnce({ id: USER_ID, email: EMAIL, twoFactorEnabled: false } as never)
  const { secret } = await generateTOTPSecret(USER_ID)
  return { secret }
}
