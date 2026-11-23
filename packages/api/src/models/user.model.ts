import type { User } from '@prisma/client';

export type SafeUser = Omit<
  User,
  'password' | 'resetToken' | 'resetTokenExpiry' | 'verificationToken' | 'verificationTokenExpiry'
>;

export function sanitizeUser(user: User): SafeUser {
  const {
    password,
    resetToken,
    resetTokenExpiry,
    verificationToken,
    verificationTokenExpiry,
    ...safe
  } = user;
  return safe;
}
