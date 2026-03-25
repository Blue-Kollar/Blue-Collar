/**
 * Validation rules for authentication and user account endpoints.
 * Rules follow simple-body-validator syntax: 'rule1|rule2|...'.
 */

// POST /auth/register
export const registerRules = {
  email: 'required|email',
  password: 'required|min:8',
  firstName: 'required|string',
  lastName: 'required|string',
}

// POST /auth/login
export const loginRules = {
  email: 'required|email',
  password: 'required',
}

// POST /auth/forgot-password
export const forgotPasswordRules = {
  email: 'required|email',
}

// PUT /auth/reset-password — token is the raw hex token from the reset email
export const resetPasswordRules = {
  token: 'required|string',
  password: 'required|min:8',
}

// PUT /auth/verify-account — token is the signed JWT from the verification email
export const verifyAccountRules = {
  token: 'required|string',
}
