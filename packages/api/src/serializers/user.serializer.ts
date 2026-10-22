import type { User } from '@prisma/client'
import { BaseSerializer } from './base.serializer.js'

export type SerializedUser = Omit<User, 'password' | 'verificationToken' | 'verificationTokenExpiry' | 'resetToken' | 'resetTokenExpiry' | 'twoFactorSecret' | 'twoFactorBackupCodes'>

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char] ?? char)
}

function sanitizeNullableString(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null
  }
  return escapeHtml(value)
}

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
    return {
      ...safe,
      firstName: escapeHtml(safe.firstName),
      lastName: escapeHtml(safe.lastName),
      bio: sanitizeNullableString(safe.bio),
    }
  }
}

export const userSerializer = new UserSerializer()