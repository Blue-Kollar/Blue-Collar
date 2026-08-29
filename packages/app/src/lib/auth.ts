import { z } from "zod";
import {
  loginSchema,
  forgotPasswordSchema,
  passwordField,
  emailField,
  nameField,
} from "@bluecollar/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Re-export shared schemas ─────────────────────────────────────────────────

export { loginSchema, forgotPasswordSchema };

/**
 * Register schema extends the shared base with a UI-only confirmPassword field.
 * The API receives only the shared fields (confirmPassword is stripped client-side).
 */
export const registerSchema = z
  .object({
    firstName: nameField,
    lastName: nameField,
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/**
 * Reset-password schema extends the shared base with a UI-only confirmPassword field.
 */
export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ─── API helpers ──────────────────────────────────────────────────────────────

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Something went wrong");
  return json as T;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Something went wrong");
  return json as T;
}

export const authApi = {
  login: (data: LoginInput) =>
    post<{ data: unknown; token: string }>("/auth/login", data),

  register: (data: Omit<RegisterInput, "confirmPassword">) =>
    post<{ data: unknown }>("/auth/register", data),

  forgotPassword: (data: ForgotPasswordInput) =>
    post<{ message: string }>("/auth/forgot-password", data),

  resetPassword: (token: string, password: string) =>
    put<{ message: string }>("/auth/reset-password", { token, password }),

  verifyAccount: (token: string) =>
    put<{ message: string }>("/auth/verify-account", { token }),

  resendVerification: (email: string) =>
    post<{ message: string }>("/auth/resend-verification", { email }),
};
