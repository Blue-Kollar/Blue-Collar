import type { ApiResponse } from "@/types";
import { request } from "./client";

export const login = (email: string, password: string) =>
  request<{ data: unknown; token: string }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });

export const register = (data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) => request<{ data: unknown }>("/auth/register", { method: "POST", body: data });

export const forgotPassword = (email: string) =>
  request<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } });

export const resetPassword = (token: string, password: string) =>
  request<{ message: string }>("/auth/reset-password", {
    method: "PUT",
    body: { token, password },
  });

export const getMe = () =>
  request<ApiResponse<unknown>>("/auth/me");

/** Used right after an OAuth redirect, before the token is persisted to localStorage. */
export const getMeWithToken = (token: string) =>
  request<ApiResponse<unknown>>("/auth/me", { headers: { Authorization: `Bearer ${token}` } });
