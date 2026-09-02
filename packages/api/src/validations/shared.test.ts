import { describe, expect,it } from 'vitest'

import { emailField, nameField, passwordField, phoneField,tokenField } from './shared.js'

describe('emailField', () => {
  it('accepts a valid email', () => {
    expect(emailField.safeParse('user@example.com').success).toBe(true)
  })

  it('rejects a missing @', () => {
    expect(emailField.safeParse('notanemail').success).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(emailField.safeParse('').success).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(emailField.safeParse(123).success).toBe(false)
  })
})

describe('passwordField', () => {
  it('accepts a password of 8 characters', () => {
    expect(passwordField.safeParse('12345678').success).toBe(true)
  })

  it('accepts a password longer than 8 characters', () => {
    expect(passwordField.safeParse('supersecret').success).toBe(true)
  })

  it('rejects a password shorter than 8 characters', () => {
    expect(passwordField.safeParse('short').success).toBe(false)
  })

  it('rejects an empty string', () => {
    expect(passwordField.safeParse('').success).toBe(false)
  })
})

describe('nameField', () => {
  it('accepts a non-empty string', () => {
    expect(nameField.safeParse('Alice').success).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(nameField.safeParse('').success).toBe(false)
  })

  it('rejects non-string values', () => {
    expect(nameField.safeParse(null).success).toBe(false)
  })
})

describe('tokenField', () => {
  it('accepts a non-empty string', () => {
    expect(tokenField.safeParse('abc123').success).toBe(true)
  })

  it('rejects an empty string', () => {
    expect(tokenField.safeParse('').success).toBe(false)
  })
})

describe('phoneField', () => {
  it('accepts a phone string', () => {
    expect(phoneField.safeParse('+1234567890').success).toBe(true)
  })

  it('accepts undefined (optional)', () => {
    expect(phoneField.safeParse(undefined).success).toBe(true)
  })
})
