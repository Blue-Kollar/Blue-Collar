import { Router } from 'express'
import {
  login,
  register,
  logout,
  forgotPassword,
  resetPassword,
  verifyAccount,
} from '../controllers/auth.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  verifyAccountRules,
} from '../validations/auth.js'

const router = Router()

router.post('/login', validate(loginRules), login)
router.post('/register', validate(registerRules), register)
router.delete('/logout', authenticate, logout)
router.post('/forgot-password', validate(forgotPasswordRules), forgotPassword)
router.put('/reset-password', validate(resetPasswordRules), resetPassword)
router.put('/verify-account', validate(verifyAccountRules), verifyAccount)

export default router
