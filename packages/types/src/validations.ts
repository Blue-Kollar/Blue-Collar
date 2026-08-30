/**
 * Shared Zod validation schemas for BlueCollar.
 *
 * These schemas are the single source of truth for validation rules used by
 * both the API (`packages/api`) and the App (`packages/app`). Import from
 * this module instead of defining schemas inline in each package.
 *
 * @example — API (server-side)
 * ```ts
 * import { loginSchema, createWorkerSchema } from '@bluecollar/types/validations'
 * const parsed = loginSchema.parse(req.body)
 * ```
 *
 * @example — App (client-side)
 * ```ts
 * import { loginSchema, type LoginInput } from '@bluecollar/types/validations'
 * const form = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })
 * ```
 */
import { z } from 'zod'

// ── Primitive field schemas ───────────────────────────────────────────────────

/** Valid email address. */
export const emailField = z.string().email('Invalid email address')

/** Password — minimum 8 characters. */
export const passwordField = z.string().min(8, 'Password must be at least 8 characters')

/** Non-empty name string. */
export const nameField = z.string().min(1, 'This field is required')

/** Non-empty opaque token (verification / reset links). */
export const tokenField = z.string().min(1, 'Token is required')

/**
 * Optional phone number field.
 * Accepts E.164-style numbers and common national formats.
 * Empty string is treated as absent (coerced to undefined by the schemas below).
 */
export const phoneField = z
  .string()
  .regex(/^\+?[\d\s\-().]{7,20}$/, 'Enter a valid phone number')
  .optional()
  .or(z.literal(''))

/**
 * Optional Stellar public key (starts with G, 56 chars, base32).
 */
export const stellarAddressField = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, 'Must be a valid Stellar public key (starts with G)')
  .optional()
  .or(z.literal(''))

// ── Auth schemas ──────────────────────────────────────────────────────────────

/** POST /auth/login */
export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
})

/** POST /auth/register */
export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  firstName: nameField,
  lastName: nameField,
})

/** POST /auth/forgot-password */
export const forgotPasswordSchema = z.object({
  email: emailField,
})

/** PUT /auth/reset-password */
export const resetPasswordSchema = z.object({
  token: tokenField,
  password: passwordField,
})

/** PUT /auth/verify-account */
export const verifyAccountSchema = z.object({
  token: tokenField,
})

/** POST /auth/resend-verification */
export const resendVerificationSchema = z.object({
  email: emailField,
})

// ── User schemas ──────────────────────────────────────────────────────────────

/** PATCH /users/me */
export const updateProfileSchema = z.object({
  firstName: nameField.max(50).optional(),
  lastName: nameField.max(50).optional(),
  email: emailField.optional(),
})

/** PUT /users/me/password */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordField,
})

// ── Worker schemas ────────────────────────────────────────────────────────────

/** POST /workers */
export const createWorkerSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    categoryId: z.string().min(1, 'Please select a category'),
    phone: phoneField,
    email: emailField.optional().or(z.literal('')),
    bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
    walletAddress: stellarAddressField,
  })
  .refine((d) => d.phone || d.email, {
    message: 'Either phone or email is required',
    path: ['phone'],
  })

/** PUT /workers/:id — all fields optional */
export const updateWorkerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').optional(),
  categoryId: z.string().optional(),
  phone: phoneField,
  email: emailField.optional().or(z.literal('')),
  bio: z.string().max(500, 'Bio must be under 500 characters').optional(),
  walletAddress: stellarAddressField,
})

/** POST /workers/:id/reviews */
export const createReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional(),
})

// ── Imperative validation helpers ────────────────────────────────────────────
// Plain functions that validate individual values and return an error string or
// undefined. Useful in non-Zod contexts (imperative form handlers, unit tests,
// custom hooks). The regex constants mirror the Zod field regexes above so
// rules stay in sync.

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_REGEX = /^\+?[\d\s\-().]{7,20}$/
export const STELLAR_ADDRESS_REGEX = /^G[A-Z2-7]{55}$/

/** Returns true when the string is a structurally valid email address. */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim())
}

/**
 * Validates an email string and returns a human-readable error message, or
 * undefined when the value is acceptable.
 */
export function validateEmail(email?: string, required = true): string | undefined {
  const trimmed = email?.trim() ?? ''
  if (!trimmed) return required ? 'Email is required' : undefined
  if (!isValidEmail(trimmed)) return 'Enter a valid email'
  return undefined
}

/** Returns true when the password meets the minimum length requirement. */
export function isValidPassword(password: string, minLength = 8): boolean {
  return typeof password === 'string' && password.length >= minLength
}

/**
 * Validates a password string and returns a human-readable error message, or
 * undefined when the value is acceptable.
 */
export function validatePassword(
  password?: string,
  minLength = 8,
  required = true,
): string | undefined {
  if (!password) return required ? 'Password is required' : undefined
  if (password.length < minLength) return `Password must be at least ${minLength} characters`
  return undefined
}

/**
 * Returns true when the value is considered non-empty (handles strings,
 * arrays, numbers, booleans, etc.).
 */
export function isRequired(value: unknown): boolean {
  if (value === null || value === undefined) return false
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.length > 0
  return true
}

/** Validates that a required field is non-empty. */
export function validateRequired(value: unknown, fieldName = 'This field'): string | undefined {
  if (!isRequired(value)) return `${fieldName} is required`
  return undefined
}

/** Validates that a string meets a minimum length. */
export function validateMinLength(
  value: string | undefined,
  min: number,
  fieldName = 'Field',
): string | undefined {
  const len = (value ?? '').trim().length
  if (len < min) return `${fieldName} must be at least ${min} characters`
  return undefined
}

/** Validates that a string does not exceed a maximum length. */
export function validateMaxLength(
  value: string | undefined,
  max: number,
  fieldName = 'Field',
): string | undefined {
  const len = (value ?? '').length
  if (len > max) return `${fieldName} must be ${max} characters or less`
  return undefined
}

/** Returns true when the string is a valid Stellar public key. */
export function isValidStellarAddress(address: string): boolean {
  return STELLAR_ADDRESS_REGEX.test(address.trim())
}

/** Validates a Stellar public key and returns a human-readable error message. */
export function validateStellarAddress(
  address?: string,
  required = false,
): string | undefined {
  const trimmed = address?.trim() ?? ''
  if (!trimmed) return required ? 'Stellar address is required' : undefined
  if (!isValidStellarAddress(trimmed))
    return 'Must be a valid Stellar public key (starts with G)'
  return undefined
}

/** Returns true when the phone string matches an accepted format. */
export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.trim())
}

/** Validates a phone number field and returns a human-readable error message. */
export function validatePhone(phone?: string, required = false): string | undefined {
  const trimmed = phone?.trim() ?? ''
  if (!trimmed) return required ? 'Phone number is required' : undefined
  if (!isValidPhone(trimmed)) return 'Enter a valid phone number'
  return undefined
}

/** Validates a positive numeric amount. */
export function validateAmount(
  amount: string | number | undefined,
  min = 0,
  fieldName = 'Amount',
): string | undefined {
  if (amount === undefined || amount === null || amount === '')
    return `${fieldName} is required`
  const parsed = typeof amount === 'number' ? amount : parseFloat(amount as string)
  if (isNaN(parsed) || !isFinite(parsed)) return `${fieldName} must be a valid number`
  if (parsed <= min) return `${fieldName} must be greater than ${min}`
  return undefined
}

/** Validates that two string values are equal (e.g. password confirmation). */
export function validateMatch(
  value1: string,
  value2: string,
  message = 'Fields do not match',
): string | undefined {
  if (value1 !== value2) return message
  return undefined
}

/** Validates standard user-profile fields and returns a map of field errors. */
export function validateUserProfile(profile: {
  firstName?: string
  lastName?: string
  email?: string
}): Partial<Record<'firstName' | 'lastName' | 'email', string>> {
  const errors: Partial<Record<'firstName' | 'lastName' | 'email', string>> = {}

  const fnError = validateRequired(profile.firstName, 'First name')
  if (fnError) errors.firstName = fnError

  const lnError = validateRequired(profile.lastName, 'Last name')
  if (lnError) errors.lastName = lnError

  const emailError = validateEmail(profile.email, true)
  if (emailError) errors.email = emailError

  return errors
}

/** Validates escrow-creation form fields and returns a map of field errors. */
export function validateEscrowForm(form: {
  amount?: string
  counterparty?: string
  terms?: string
}): Partial<Record<'amount' | 'counterparty' | 'terms', string>> {
  const errors: Partial<Record<'amount' | 'counterparty' | 'terms', string>> = {}

  const amountError = validateAmount(form.amount, 0, 'Amount')
  if (amountError) errors.amount = amountError

  const counterpartyError = validateRequired(form.counterparty, 'Counterparty address')
  if (counterpartyError) errors.counterparty = counterpartyError

  const termsError = validateRequired(form.terms, 'Terms')
  if (termsError) errors.terms = termsError

  return errors
}

/** Validates contact message content. */
export function validateContactMessage(
  message: string,
  minLength = 10,
  maxLength = 1000,
): { isValid: boolean; error?: string } {
  const trimmed = message.trim()
  if (!trimmed) return { isValid: false, error: 'Message cannot be empty' }
  if (trimmed.length < minLength)
    return { isValid: false, error: `Message must be at least ${minLength} characters` }
  if (trimmed.length > maxLength)
    return { isValid: false, error: `Message must be ${maxLength} characters or less` }
  return { isValid: true }
}

// ── Inferred TypeScript types ─────────────────────────────────────────────────

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type VerifyAccountInput = z.infer<typeof verifyAccountSchema>
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type CreateWorkerInput = z.infer<typeof createWorkerSchema>
export type UpdateWorkerInput = z.infer<typeof updateWorkerSchema>
export type CreateReviewInput = z.infer<typeof createReviewSchema>
