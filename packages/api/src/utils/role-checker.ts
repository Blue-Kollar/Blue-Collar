export function hasRole(user: { role: string } | null | undefined, roles: string[]): boolean {
  return !!user && roles.includes(user.role)
}
