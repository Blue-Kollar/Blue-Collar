import type { User } from '@prisma/client'

export function UserResource(user: User) {
  const { password, ...safeUser } = user
  return safeUser
}

export function UserCollection(users: User[]) {
  return users.map(UserResource)
}
