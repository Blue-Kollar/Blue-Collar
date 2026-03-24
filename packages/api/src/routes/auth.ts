import { Router } from 'express'
import {
  login,
  register,
  logout,
  forgotPassword,
  resetPassword,
  verifyAccount,
  googleAuthCallback,
} from '../controllers/auth.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import passport from '../config/passport.js'
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  verifyAccountRules,
} from '../validations/auth.js'

const router = Router()

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }))
router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=unauthorized', session: false }),
  googleAuthCallback
)
router.post('/login', validate(loginRules), login)
router.post('/register', validate(registerRules), register)
router.delete('/logout', authenticate, logout)
router.post('/forgot-password', validate(forgotPasswordRules), forgotPassword)
router.put('/reset-password', validate(resetPasswordRules), resetPassword)
router.put('/verify-account', validate(verifyAccountRules), verifyAccount)

export default router
