import type { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import * as authService from '../services/auth.service.js'
import { handleError } from '../utils/handleError.js'
import { UserResource } from '../resources/index.js'
import type { LoginBody, RegisterBody, ForgotPasswordBody, ResetPasswordBody } from '../interfaces/index.js'

export async function login(req: Request<{}, {}, LoginBody>, res: Response) {
  try {
    const { data, token } = await authService.loginUser(req.body)
    return res.status(202).json({
      data: UserResource(data as any),
      status: 'success',
      message: 'Login successful',
      code: 202,
      token
    })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function register(req: Request<{}, {}, RegisterBody>, res: Response) {
  try {
    const data = await authService.registerUser(req.body)
    return res.status(201).json({
      data: UserResource(data as any),
      status: 'success',
      message: 'Registration successful. Please check your email to verify your account.',
      code: 201,
    })
  } catch (err) {
    return handleError(res, err)
  }
}

export const verifyAccount = catchAsync(async (req: Request, res: Response) => {
  const token = (req.query.token ?? req.body.token) as string | undefined
  if (!token) {
    throw new AppError('Verification token is required', 400)
  }
  try {
    const verified = await authService.verifyAccount(token)
    const message = verified ? 'Email verified successfully' : 'Email already verified'
    return res.status(200).json({ status: 'success', message, code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function googleAuthCallback(req: Request, res: Response) {
  const user = req.user as any
  if (!user) return res.redirect(`${env.APP_URL}/login?error=oauth-failed`)
  const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '7d' })
  return res.redirect(`${env.APP_URL}/auth-callback?token=${token}`)
}

export async function logout(_req: Request, res: Response) {
  return res.status(200).json({ status: 'success', message: 'Logged out', code: 200 })
}

export async function forgotPassword(req: Request<{}, {}, ForgotPasswordBody>, res: Response) {
  try {
    await authService.requestPasswordReset(req.body.email)
    return res.status(200).json({
      status: 'success',
      message: 'If an account exists with that email, a password reset link has been sent.',
      code: 200,
    })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function resetPassword(req: Request<{}, {}, ResetPasswordBody>, res: Response) {
  const { token, password } = req.body
  if (!token || !password) {
    throw new AppError('Token and password are required', 400)
  }
  try {
    await authService.resetPassword(token, password)
    return res.status(200).json({ status: 'success', message: 'Password reset successful', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
