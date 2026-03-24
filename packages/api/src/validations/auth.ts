/**
 * Validation rules for authentication and user accounts.
 */
export const registerRules = {
  email: 'required|email',
  password: 'required|min:8',
  firstName: 'required|string',
  lastName: 'required|string',
};

export const loginRules = {
  email: 'required|email',
  password: 'required',
};

export const forgotPasswordRules = {
  email: 'required|email',
};

export const resetPasswordRules = {
  token: 'required|string',
  password: 'required|min:8',
};

export const verifyAccountRules = {
  token: 'required|string',
};
