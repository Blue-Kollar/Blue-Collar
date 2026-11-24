import { Router } from 'express';
import {
  login,
  register,
  logout,
  me,
  forgotPassword,
  resetPassword,
  verifyAccount,
  resendVerification,
  googleAuthCallback,
  unsubscribeReminders,
  refresh,
} from '@/controllers/auth.js';
import {
  setup2FA,
  enable2FA,
  verify2FA,
  verifyBackupCode,
  disable2FA,
  regenerateBackupCodes,
} from '@/controllers/two-factor.js';
import { authenticate } from '@/middleware/auth.js';
import { validate } from '@/middleware/validate.js';
import { moderateAuthRateLimiter, strictAuthRateLimiter } from '@/config/rate-limiter.js';
import passport from '@/config/passport.js';
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  verifyAccountRules,
  resendVerificationRules,
} from '@/validations/index.js';

import { idempotency } from '@/middleware/idempotency.js';

const router = Router();

// ── Google OAuth ──────────────────────────────────────────────────────────────
// Initiates the OAuth flow; redirects the user to Google's consent screen.
// All OAuth logic (token issuance, redirect URL construction) lives in
// services/auth.service.ts (googleAuthCallback controller delegates to it).
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Google redirects back here after the user grants (or denies) access.
// On success the handler issues a JWT and redirects to the frontend callback URL.
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=unauthorized', session: false }),
  googleAuthCallback,
);

// ── Email / password ──────────────────────────────────────────────────────────
router.post('/login', strictAuthRateLimiter, validate(loginRules), login);
router.post('/register', moderateAuthRateLimiter, idempotency, validate(registerRules), register);

// Requires a valid JWT; revokes all refresh tokens on logout.
router.delete('/logout', authenticate, logout);

// Exchange a refresh token for a new access + refresh token pair.
router.post('/refresh', refresh);

// Returns the currently authenticated user's profile.
router.get('/me', authenticate, me);

// ── Email verification ────────────────────────────────────────────────────────
// Accepts ?token=<jwt> as a query param (email link) or a body field.
// Token parsing, hashing and account state changes live in
// services/auth.service.ts (verifyAccount controller delegates to it).
router.put('/verify-account', validate(verifyAccountRules), verifyAccount);
router.post('/resend-verification', validate(resendVerificationRules), resendVerification);

// Unsubscribe from verification reminder emails via token in email link
router.get('/unsubscribe-reminders', unsubscribeReminders);

// ── Password reset ────────────────────────────────────────────────────────────
// Sends a reset link to the given email (always 200 to prevent enumeration).
// Token generation/hashing and password updates live in
// services/auth.service.ts (recovery sub-service).
router.post(
  '/forgot-password',
  strictAuthRateLimiter,
  validate(forgotPasswordRules),
  forgotPassword,
);

// Validates the raw reset token (hashed and compared server-side), then
// updates the password and clears the reset token fields.
router.put('/reset-password', validate(resetPasswordRules), resetPassword);

// ── Two-Factor Authentication (TOTP) ─────────────────────────────────────────
// TOTP secret generation, backup-code hashing and verification logic live in
// services/auth.service.ts (2FA sub-service).
router.post('/2fa/setup', authenticate, setup2FA);
router.post('/2fa/enable', authenticate, enable2FA);
router.post('/2fa/verify', verify2FA);
router.post('/2fa/verify-backup', verifyBackupCode);
router.delete('/2fa', authenticate, disable2FA);
router.post('/2fa/backup-codes/regenerate', authenticate, regenerateBackupCodes);

export default router;
