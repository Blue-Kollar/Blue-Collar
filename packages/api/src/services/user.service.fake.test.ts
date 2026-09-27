/**
 * user.service.fake.test.ts — Issue #1354
 *
 * Fast unit-test conversion: exercises createUserService via the in-memory
 * FakeUserRepository and a stub mailer instead of vi.mock('../db.js') +
 * vi.mock('../mailer/index.js') (see user.service.test.ts), avoiding any
 * module-mocking setup.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createUserService } from './user.service.js'
import { FakeUserRepository } from '../__tests__/helpers/fakeRepositories.js'
import { AppError } from '../utils/AppError.js'

vi.mock('../utils/logger.js', () => ({
  createServiceLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}))

describe('createUserService (fake repository)', () => {
  let repo: FakeUserRepository
  let mailer: { sendVerificationEmail: ReturnType<typeof vi.fn>; sendPasswordResetEmail: ReturnType<typeof vi.fn> }
  let service: ReturnType<typeof createUserService>

  beforeEach(() => {
    repo = new FakeUserRepository()
    mailer = { sendVerificationEmail: vi.fn(), sendPasswordResetEmail: vi.fn() }
    service = createUserService({ userRepository: repo, mailer })

    repo.seed({
      id: 'user-1',
      email: 'old@example.com',
      firstName: 'Old',
      lastName: 'Name',
      verified: true,
    })
  })

  it('updateProfile updates fields without touching verification when email is unchanged', async () => {
    const result = await service.updateProfile('user-1', { firstName: 'New' })

    expect(result.firstName).toBe('New')
    expect(mailer.sendVerificationEmail).not.toHaveBeenCalled()
  })

  it('updateProfile resets verification and emails the user when email changes', async () => {
    await service.updateProfile('user-1', { email: 'new@example.com' })

    const stored = await repo.findById('user-1')
    expect(stored.verified).toBe(false)
    expect(mailer.sendVerificationEmail).toHaveBeenCalledTimes(1)
  })

  it('updateProfile throws 404 for an unknown user', async () => {
    await expect(service.updateProfile('missing', { firstName: 'X' })).rejects.toBeInstanceOf(AppError)
  })
})
