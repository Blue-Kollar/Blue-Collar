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
  // Imperative helpers
  isValidEmail,
  validateEmail,
  isValidPassword,
  validatePassword,
  isRequired,
  validateRequired,
  validateMinLength,
  validateMaxLength,
  isValidStellarAddress,
  validateStellarAddress,
  isValidPhone,
  validatePhone,
  validateAmount,
  validateMatch,
  validateUserProfile,
  validateEscrowForm,
  validateContactMessage,
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

// ─── Imperative validation helpers ───────────────────────────────────────────

describe('isValidEmail / validateEmail', () => {
  it('accepts well-formed email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('first.last@domain.co.uk')).toBe(true)
    expect(isValidEmail('user+tag@domain.org')).toBe(true)
  })

  it('rejects malformed email addresses', () => {
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('user@')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })

  it('validateEmail returns the correct error message', () => {
    expect(validateEmail('')).toBe('Email is required')
    expect(validateEmail('', false)).toBeUndefined()
    expect(validateEmail('invalid-email')).toBe('Enter a valid email')
    expect(validateEmail('test@example.com')).toBeUndefined()
  })
})

describe('isValidPassword / validatePassword', () => {
  it('accepts passwords meeting the minimum length', () => {
    expect(isValidPassword('12345678')).toBe(true)
    expect(isValidPassword('short', 5)).toBe(true)
  })

  it('rejects passwords that are too short', () => {
    expect(isValidPassword('short')).toBe(false)
  })

  it('validatePassword returns the correct error message', () => {
    expect(validatePassword('')).toBe('Password is required')
    expect(validatePassword('', 8, false)).toBeUndefined()
    expect(validatePassword('short', 8)).toBe('Password must be at least 8 characters')
    expect(validatePassword('validpassword123')).toBeUndefined()
  })
})

describe('isRequired / validateRequired', () => {
  it('treats non-empty values as present', () => {
    expect(isRequired('hello')).toBe(true)
    expect(isRequired([1])).toBe(true)
    expect(isRequired(0)).toBe(true)
    expect(isRequired(false)).toBe(true)
  })

  it('treats empty / null / undefined as absent', () => {
    expect(isRequired('')).toBe(false)
    expect(isRequired('  ')).toBe(false)
    expect(isRequired(null)).toBe(false)
    expect(isRequired(undefined)).toBe(false)
    expect(isRequired([])).toBe(false)
  })

  it('validateRequired returns the correct error message', () => {
    expect(validateRequired('', 'Name')).toBe('Name is required')
    expect(validateRequired('Alice', 'Name')).toBeUndefined()
  })
})

describe('validateMinLength / validateMaxLength', () => {
  it('enforces minimum string length', () => {
    expect(validateMinLength('ab', 3, 'Code')).toBe('Code must be at least 3 characters')
    expect(validateMinLength('abc', 3, 'Code')).toBeUndefined()
  })

  it('enforces maximum string length', () => {
    expect(validateMaxLength('toolongstring', 5, 'Code')).toBe('Code must be 5 characters or less')
    expect(validateMaxLength('ok', 5, 'Code')).toBeUndefined()
  })
})

describe('isValidStellarAddress / validateStellarAddress', () => {
  const valid = 'G' + 'A'.repeat(55)

  it('accepts valid Stellar public keys', () => {
    expect(isValidStellarAddress(valid)).toBe(true)
  })

  it('rejects keys that do not start with G', () => {
    expect(isValidStellarAddress('S' + 'A'.repeat(55))).toBe(false)
  })

  it('rejects keys of the wrong length', () => {
    expect(isValidStellarAddress('G' + 'A'.repeat(50))).toBe(false)
  })

  it('rejects plain invalid strings', () => {
    expect(isValidStellarAddress('invalid')).toBe(false)
  })

  it('validateStellarAddress returns the correct error message', () => {
    expect(validateStellarAddress('', true)).toBe('Stellar address is required')
    expect(validateStellarAddress('', false)).toBeUndefined()
    expect(validateStellarAddress('invalid')).toBe(
      'Must be a valid Stellar public key (starts with G)',
    )
    expect(validateStellarAddress(valid)).toBeUndefined()
  })
})

describe('isValidPhone / validatePhone', () => {
  it('accepts valid phone formats', () => {
    expect(isValidPhone('+1234567890')).toBe(true)
    expect(isValidPhone('(555) 123-4567')).toBe(true)
  })

  it('rejects too-short phone strings', () => {
    expect(isValidPhone('123')).toBe(false)
  })

  it('validatePhone returns the correct error message', () => {
    expect(validatePhone('', true)).toBe('Phone number is required')
    expect(validatePhone('', false)).toBeUndefined()
    expect(validatePhone('abc')).toBe('Enter a valid phone number')
    expect(validatePhone('+1234567890')).toBeUndefined()
  })
})

describe('validateAmount', () => {
  it('rejects empty / undefined values', () => {
    expect(validateAmount('')).toBe('Amount is required')
    expect(validateAmount(undefined)).toBe('Amount is required')
  })

  it('rejects non-numeric strings', () => {
    expect(validateAmount('notanumber')).toBe('Amount must be a valid number')
  })

  it('rejects zero and negative values (default min = 0)', () => {
    expect(validateAmount('-5')).toBe('Amount must be greater than 0')
    expect(validateAmount('0')).toBe('Amount must be greater than 0')
  })

  it('accepts positive values', () => {
    expect(validateAmount('10.5')).toBeUndefined()
    expect(validateAmount(25)).toBeUndefined()
  })
})

describe('validateMatch', () => {
  it('returns undefined when values match', () => {
    expect(validateMatch('secret', 'secret')).toBeUndefined()
  })

  it('returns a custom message when values differ', () => {
    expect(validateMatch('secret', 'other', 'Mismatch')).toBe('Mismatch')
  })
})

describe('validateUserProfile', () => {
  it('returns field errors for invalid data', () => {
    const errors = validateUserProfile({ firstName: '', lastName: '', email: 'bad' })
    expect(errors.firstName).toBe('First name is required')
    expect(errors.lastName).toBe('Last name is required')
    expect(errors.email).toBe('Enter a valid email')
  })

  it('returns an empty object for valid data', () => {
    expect(
      validateUserProfile({ firstName: 'John', lastName: 'Doe', email: 'john@example.com' }),
    ).toEqual({})
  })
})

describe('validateEscrowForm', () => {
  it('returns field errors for invalid data', () => {
    const errors = validateEscrowForm({ amount: '0', counterparty: '', terms: '' })
    expect(errors.amount).toBe('Amount must be greater than 0')
    expect(errors.counterparty).toBe('Counterparty address is required')
    expect(errors.terms).toBe('Terms is required')
  })

  it('returns an empty object for valid data', () => {
    expect(
      validateEscrowForm({ amount: '100', counterparty: 'G123', terms: 'Delivery of goods' }),
    ).toEqual({})
  })
})

describe('validateContactMessage', () => {
  it('rejects empty messages', () => {
    expect(validateContactMessage('').isValid).toBe(false)
    expect(validateContactMessage('').error).toBe('Message cannot be empty')
  })

  it('rejects messages below the minimum length', () => {
    expect(validateContactMessage('short').isValid).toBe(false)
  })

  it('rejects messages exceeding the maximum length', () => {
    expect(validateContactMessage('a'.repeat(1001)).isValid).toBe(false)
  })

  it('accepts messages within range', () => {
    expect(validateContactMessage('A valid message with sufficient length').isValid).toBe(true)
  })
})
