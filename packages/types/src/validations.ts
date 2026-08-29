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
