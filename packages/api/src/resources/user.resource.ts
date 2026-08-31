import type { User } from '@prisma/client'
import type { SafeUser } from '../models/user.model.js'

export function UserResource(user: User): Omit<User, 'password'>
export function UserResource(user: SafeUser): SafeUser
export function UserResource(user: User | SafeUser): Omit<User, 'password'> | SafeUser {
  if ('password' in user) {
    const { password, ...safeUser } = user
    return safeUser
  }
  return user
}

export function UserCollection(users: User[]) {
  return users.map(UserResource)
}
