import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import * as authService from "../services/auth.service.js";
import { handleError } from "../utils/handleError.js";
import { db } from "../db.js";
import { sanitizeUser } from "../models/user.model.js";
import { UserResource } from "../resources/index.js";
import { AppError } from "../services/AppError.js";
import { catchAsync } from "../utils/catchAsync.js";
import type { Request, Response } from "express";
import type {
  LoginBody,
  RegisterBody,
  ForgotPasswordBody,
  ResetPasswordBody,
} from "../interfaces/index.js";

/**
 * POST /api/auth/login
 * Authenticate a user with email and password.
 *
 * @param req - Body: `{ email, password }`.
 * @param res - JSON `{ data: User, token, status, code: 202 }`.
 * @throws AppError 401 if credentials are invalid.
 * @throws AppError 403 if the account is not yet verified.
 */
export async function login(req: Request<{}, {}, LoginBody>, res: Response) {
  try {
    const { data, token } = await authService.loginUser(req.body);
    return res.status(202).json({
      data: UserResource(data as any),
      status: "success",
      message: "Login successful",
      code: 202,
      token,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * POST /api/auth/register
 * Create a new user account and send a verification email.
 *
 * @param req - Body: `{ email, password, firstName, lastName }`.
 * @param res - JSON `{ data: User, status, code: 201 }`.
 * @throws AppError 409 if the email is already in use.
 */
export async function register(
  req: Request<{}, {}, RegisterBody>,
  res: Response,
) {
  try {
    const data = await authService.registerUser(req.body);
    return res.status(201).json({
      data: UserResource(data as any),
      status: "success",
      message:
        "Registration successful. Please check your email to verify your account.",
      code: 201,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * PUT /api/auth/verify-account
 * Verify a user's email address using the token sent in the verification email.
 *
 * @param req - Query param or body field `token`.
 * @param res - JSON `{ status, message, code: 200 }`.
 * @throws AppError 400 if the token is missing, invalid, or expired.
 */
export const verifyAccount = catchAsync(async (req: Request, res: Response) => {
  const token = (req.query.token ?? req.body.token) as string | undefined;
  if (!token) {
    throw new AppError("Verification token is required", 400);
  }
  try {
    const verified = await authService.verifyAccount(token);
    const message = verified
      ? "Email verified successfully"
      : "Email already verified";
    return res.status(200).json({ status: "success", message, code: 200 });
  } catch (err) {
    return handleError(res, err);
  }
});

/**
 * GET /api/auth/google/callback
 * Handle the Google OAuth callback. Issues a JWT and redirects to the frontend.
 *
 * @param req - `req.user` is populated by Passport's Google strategy.
 * @param res - Redirects to `APP_URL/auth-callback?token=<jwt>` on success,
 *              or `APP_URL/login?error=oauth-failed` on failure.
 */
export async function googleAuthCallback(req: Request, res: Response) {
  const user = req.user as any;
  if (!user) return res.redirect(`${env.APP_URL}/login?error=oauth-failed`);
  const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
    expiresIn: "7d",
  });
  return res.redirect(`${env.APP_URL}/auth-callback?token=${token}`);
}

/**
 * DELETE /api/auth/logout
 * Stateless logout — instructs the client to discard its JWT.
 *
 * @param _req - Unused.
 * @param res - JSON `{ status, message, code: 200 }`.
 */
export async function logout(_req: Request, res: Response) {
  return res
    .status(200)
    .json({ status: "success", message: "Logged out", code: 200 });
}

/**
 * GET /api/auth/me
 * Return the currently authenticated user's profile.
 *
 * @param req - `req.user` must be set by the `authenticate` middleware.
 * @param res - JSON `{ data: User, status, code: 200 }`.
 * @throws 404 if the user record no longer exists.
 */
export async function me(req: Request, res: Response) {
  try {
    const { id } = req.user!;
    const user = await db.user.findUnique({ where: { id } });
    if (!user)
      return res
        .status(404)
        .json({ status: "error", message: "User not found", code: 404 });
    return res
      .status(200)
      .json({ data: sanitizeUser(user), status: "success", code: 200 });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * POST /api/auth/forgot-password
 * Send a password reset email. Always returns 200 to prevent email enumeration.
 *
 * @param req - Body: `{ email }`.
 * @param res - JSON `{ status, message, code: 200 }`.
 */
export async function forgotPassword(
  req: Request<{}, {}, ForgotPasswordBody>,
  res: Response,
) {
  try {
    await authService.requestPasswordReset(req.body.email);
    return res.status(200).json({
      status: "success",
      message:
        "If an account exists with that email, a password reset link has been sent.",
      code: 200,
    });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * PUT /api/auth/reset-password
 * Reset a user's password using the token from the reset email.
 *
 * @param req - Body: `{ token, password }`.
 * @param res - JSON `{ status, message, code: 200 }`.
 * @throws AppError 400 if `token` or `password` is missing, or if the token is invalid/expired.
 */
export async function resetPassword(
  req: Request<{}, {}, ResetPasswordBody>,
  res: Response,
) {
  const { token, password } = req.body;
  if (!token || !password) {
    throw new AppError("Token and password are required", 400);
  }
  try {
    await authService.resetPassword(token, password);
    return res
      .status(200)
      .json({
        status: "success",
        message: "Password reset successful",
        code: 200,
      });
  } catch (err) {
    return handleError(res, err);
  }
}

/**
 * GET /api/auth/unsubscribe-reminders?token=<jwt>
 * Opt a user out of verification reminder emails.
 */
export async function unsubscribeReminders(req: Request, res: Response) {
  const { token } = req.query
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ status: 'error', message: 'Token is required', code: 400 })
  }
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { id?: string; purpose?: string }
    if (payload.purpose !== 'unsubscribe-reminders' || !payload.id) {
      return res.status(400).json({ status: 'error', message: 'Invalid token', code: 400 })
    }
    await db.user.update({ where: { id: payload.id }, data: { unsubscribedReminders: true } })
    return res.json({ status: 'success', message: 'You have been unsubscribed from reminder emails', code: 200 })
  } catch {
    return res.status(400).json({ status: 'error', message: 'Invalid or expired token', code: 400 })
  }
}
