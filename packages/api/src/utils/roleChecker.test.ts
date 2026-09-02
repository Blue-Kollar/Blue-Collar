import { describe, expect,it } from 'vitest'

import { hasRole } from './roleChecker.js'

describe('hasRole', () => {
  it('returns true when the user role is in the allowed list', () => {
    expect(hasRole({ id: 'u1', role: 'admin' }, ['admin'])).toBe(true)
  })

  it('returns true when the user role matches one of multiple allowed roles', () => {
    expect(hasRole({ id: 'u1', role: 'curator' }, ['admin', 'curator'])).toBe(true)
  })

  it('returns false when the user role is not in the allowed list', () => {
    expect(hasRole({ id: 'u1', role: 'user' }, ['admin'])).toBe(false)
  })

  it('returns false when user is undefined', () => {
    expect(hasRole(undefined, ['admin'])).toBe(false)
  })

  it('returns false when user is null', () => {
    expect(hasRole(null, ['admin'])).toBe(false)
  })

  it('returns false when roles list is empty', () => {
    expect(hasRole({ id: 'u1', role: 'admin' }, [])).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(hasRole({ id: 'u1', role: 'Admin' }, ['admin'])).toBe(false)
  })
})
