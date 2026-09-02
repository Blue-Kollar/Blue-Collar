import type { User } from '@prisma/client'

import { BaseSerializer } from './base.serializer.js'

export type SerializedUser = Omit<User, 'password' | 'verificationToken' | 'verificationTokenExpiry' | 'resetToken' | 'resetTokenExpiry' | 'twoFactorSecret' | 'twoFactorBackupCodes'>

export class UserSerializer extends BaseSerializer<User, SerializedUser> {
  serialize(user: User): SerializedUser {
    const {
      password,
      verificationToken,
      verificationTokenExpiry,
      resetToken,
      resetTokenExpiry,
      twoFactorSecret,
      twoFactorBackupCodes,
      ...safe
    } = user
    return safe
  }
}

export const userSerializer = new UserSerializer()
