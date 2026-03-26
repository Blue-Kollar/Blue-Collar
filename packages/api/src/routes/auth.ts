import { Router } from 'express'
import {
  login,
  register,
  logout,
  me,
  forgotPassword,
  resetPassword,
  verifyAccount,
  googleAuthCallback,
} from '../controllers/auth.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { authRateLimiter } from '../config/rateLimiter.js'
import passport from '../config/passport.js'
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  verifyAccountRules,
} from '../validations/auth.js'

const router = Router()

// ── Google OAuth ──────────────────────────────────────────────────────────────
// Initiates the OAuth flow; redirects the user to Google's consent screen.
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))

// Google redirects back here after the user grants (or denies) access.
// On success the handler issues a JWT and redirects to the frontend callback URL.
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=unauthorized', session: false }),
  googleAuthCallback,
)

// ── Email / password ──────────────────────────────────────────────────────────
router.post('/login', validate(loginRules), login)
router.post('/register', validate(registerRules), register)

// Requires a valid JWT; stateless logout (client discards the token).
router.delete('/logout', authenticate, logout)

// Returns the currently authenticated user's profile.
router.get('/me', authenticate, me)

// ── Email verification ────────────────────────────────────────────────────────
// Accepts ?token=<jwt> as a query param (email link) or a body field.
// Verifies the SHA-256 hash of the token against the stored hash, then marks
// the account as verified and clears the token fields.
router.put('/verify-account', validate(verifyAccountRules), verifyAccount)

// ── Password reset ────────────────────────────────────────────────────────────
// Sends a reset link to the given email (always 200 to prevent enumeration).
router.post('/forgot-password', validate(forgotPasswordRules), forgotPassword)

// Validates the raw reset token (hashed and compared server-side), then
// updates the password and clears the reset token fields.
router.put('/reset-password', validate(resetPasswordRules), resetPassword)

export default router
