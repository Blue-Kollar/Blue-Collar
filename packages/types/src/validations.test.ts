/**
 * Parity tests for shared validation schemas in @bluecollar/types.
 *
 * These tests confirm that the schemas correctly accept valid data and reject
 * invalid data, ensuring API and App validation behaves identically since both
 * packages consume these same schemas.
 */
import { describe, it, expect } from 'vitest'
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  createWorkerSchema,
  updateWorkerSchema,
  createReviewSchema,
  updateProfileSchema,
  changePasswordSchema,
} from './validations.js'

// ── loginSchema ───────────────────────────────────────────────────────────────

describe('loginSchema', () => {
  it('accepts valid credentials', () => {
    expect(() => loginSchema.parse({ email: 'user@example.com', password: 'secret' })).not.toThrow()
  })
  it('rejects invalid email', () => {
    expect(() => loginSchema.parse({ email: 'not-an-email', password: 'secret' })).toThrow()
  })
  it('rejects empty password', () => {
    expect(() => loginSchema.parse({ email: 'user@example.com', password: '' })).toThrow()
  })
})

// ── registerSchema ────────────────────────────────────────────────────────────

describe('registerSchema', () => {
  const valid = { email: 'user@example.com', password: 'password123', firstName: 'Alice', lastName: 'Smith' }

  it('accepts valid registration data', () => {
    expect(() => registerSchema.parse(valid)).not.toThrow()
  })
  it('rejects short password (< 8 chars)', () => {
    expect(() => registerSchema.parse({ ...valid, password: 'short' })).toThrow()
  })
  it('rejects missing firstName', () => {
    expect(() => registerSchema.parse({ ...valid, firstName: '' })).toThrow()
  })
  it('rejects invalid email', () => {
    expect(() => registerSchema.parse({ ...valid, email: 'bad' })).toThrow()
  })
})

// ── forgotPasswordSchema ──────────────────────────────────────────────────────

describe('forgotPasswordSchema', () => {
  it('accepts valid email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'user@example.com' })).not.toThrow()
  })
  it('rejects invalid email', () => {
    expect(() => forgotPasswordSchema.parse({ email: 'notvalid' })).toThrow()
  })
})

// ── resetPasswordSchema ───────────────────────────────────────────────────────

describe('resetPasswordSchema', () => {
  it('accepts valid token and password', () => {
    expect(() => resetPasswordSchema.parse({ token: 'abc123', password: 'newpassword' })).not.toThrow()
  })
  it('rejects short password', () => {
    expect(() => resetPasswordSchema.parse({ token: 'abc123', password: 'short' })).toThrow()
  })
  it('rejects empty token', () => {
    expect(() => resetPasswordSchema.parse({ token: '', password: 'newpassword' })).toThrow()
  })
})

// ── updateProfileSchema ───────────────────────────────────────────────────────

describe('updateProfileSchema', () => {
  it('accepts empty object (all optional)', () => {
    expect(() => updateProfileSchema.parse({})).not.toThrow()
  })
  it('accepts partial update', () => {
    expect(() => updateProfileSchema.parse({ firstName: 'Bob' })).not.toThrow()
  })
  it('rejects invalid email', () => {
    expect(() => updateProfileSchema.parse({ email: 'bad' })).toThrow()
  })
  it('rejects firstName exceeding 50 chars', () => {
    expect(() => updateProfileSchema.parse({ firstName: 'A'.repeat(51) })).toThrow()
  })
})

// ── changePasswordSchema ──────────────────────────────────────────────────────

describe('changePasswordSchema', () => {
  it('accepts valid current and new password', () => {
    expect(() =>
      changePasswordSchema.parse({ currentPassword: 'oldpass', newPassword: 'newpass123' })
    ).not.toThrow()
  })
  it('rejects short new password', () => {
    expect(() =>
      changePasswordSchema.parse({ currentPassword: 'oldpass', newPassword: 'short' })
    ).toThrow()
  })
})

// ── createWorkerSchema ────────────────────────────────────────────────────────

describe('createWorkerSchema', () => {
  const base = {
    name: 'John Doe',
    categoryId: 'cat-1',
    phone: '+1 234 567 8900',
  }

  it('accepts valid worker with phone', () => {
    expect(() => createWorkerSchema.parse(base)).not.toThrow()
  })

  it('accepts valid worker with email instead of phone', () => {
    const { phone: _p, ...noPhone } = base
    expect(() => createWorkerSchema.parse({ ...noPhone, email: 'worker@example.com' })).not.toThrow()
  })

  it('rejects name shorter than 2 chars', () => {
    expect(() => createWorkerSchema.parse({ ...base, name: 'A' })).toThrow()
  })

  it('rejects missing categoryId', () => {
    expect(() => createWorkerSchema.parse({ ...base, categoryId: '' })).toThrow()
  })

  it('rejects when neither phone nor email provided', () => {
    const { phone: _p, ...noPhone } = base
    expect(() => createWorkerSchema.parse(noPhone)).toThrow()
  })

  it('rejects invalid Stellar wallet address', () => {
    expect(() => createWorkerSchema.parse({ ...base, walletAddress: 'not-a-stellar-key' })).toThrow()
  })

  it('accepts valid Stellar wallet address', () => {
    const key = 'G' + 'A'.repeat(55)
    expect(() => createWorkerSchema.parse({ ...base, walletAddress: key })).not.toThrow()
  })

  it('rejects bio longer than 500 chars', () => {
    expect(() => createWorkerSchema.parse({ ...base, bio: 'x'.repeat(501) })).toThrow()
  })
})

// ── updateWorkerSchema ────────────────────────────────────────────────────────

describe('updateWorkerSchema', () => {
  it('accepts empty object (all optional)', () => {
    expect(() => updateWorkerSchema.parse({})).not.toThrow()
  })
  it('accepts partial update', () => {
    expect(() => updateWorkerSchema.parse({ name: 'Updated Name' })).not.toThrow()
  })
  it('rejects name shorter than 2 chars when provided', () => {
    expect(() => updateWorkerSchema.parse({ name: 'A' })).toThrow()
  })
})

// ── createReviewSchema ────────────────────────────────────────────────────────

describe('createReviewSchema', () => {
  it('accepts rating 1–5 with optional comment', () => {
    expect(() => createReviewSchema.parse({ rating: 4 })).not.toThrow()
    expect(() => createReviewSchema.parse({ rating: 5, comment: 'Great!' })).not.toThrow()
  })
  it('rejects rating 0', () => {
    expect(() => createReviewSchema.parse({ rating: 0 })).toThrow()
  })
  it('rejects rating 6', () => {
    expect(() => createReviewSchema.parse({ rating: 6 })).toThrow()
  })
  it('rejects non-integer rating', () => {
    expect(() => createReviewSchema.parse({ rating: 3.5 })).toThrow()
  })
})
