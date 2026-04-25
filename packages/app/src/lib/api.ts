/**
 * Centralized API client.
 * Automatically attaches the JWT from localStorage, handles 401s by
 * clearing auth state and redirecting to /auth/login.
 */

import type { Worker, Category, ApiResponse, Meta, Review } from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const TOKEN_KEY = "bc_token";

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip JSON serialisation — used for FormData uploads */
  rawBody?: BodyInit;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, rawBody, headers: extraHeaders, ...rest } = options;

  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(extraHeaders as Record<string, string>),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  // 401 — clear token and redirect to login
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/auth/login";
    throw new Error("Unauthorized");
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Request failed");
  return json as T;
}

// ─── Typed endpoint functions ─────────────────────────────────────────────────

// Auth
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

// Workers
export const getWorkers = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Worker[]> & { meta: Meta }>(`/workers${qs}`);
};

export const getMyWorkers = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Worker[]> & { meta: Meta }>(`/workers/mine${qs}`);
};

export const getWorker = (id: string) =>
  request<ApiResponse<Worker>>(`/workers/${id}`);

export const createWorker = (data: FormData) =>
  request<ApiResponse<Worker>>("/workers", {
    method: "POST",
    rawBody: data,
  });

export const updateWorker = (id: string, data: FormData) =>
  request<ApiResponse<Worker>>(`/workers/${id}`, {
    method: "POST",
    rawBody: data,
    headers: { "X-HTTP-Method": "PUT" },
  });

export const deleteWorker = (id: string) =>
  request<void>(`/workers/${id}`, { method: "DELETE" });

export const toggleWorker = (id: string) =>
  request<ApiResponse<Worker>>(`/workers/${id}/toggle`, { method: "PATCH" });

// Bookmarks
export const toggleBookmark = (workerId: string) =>
  request<ApiResponse<{ bookmarked: boolean }>>(`/workers/${workerId}/bookmark`, { method: "POST" });

export const getMyBookmarks = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Worker[]> & { meta: Meta }>(`/users/me/bookmarks${qs}`);
};

// Reviews
export const getWorkerReviews = (workerId: string, params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Review[]> & { meta: Meta; averageRating: number | null; reviewCount: number }>(
    `/workers/${workerId}/reviews${qs}`
  );
};

export const createReview = (workerId: string, data: { rating: number; comment?: string }) =>
  request<ApiResponse<Review>>(`/workers/${workerId}/reviews`, { method: "POST", body: data });

// Categories
export const getCategories = () =>
  request<ApiResponse<Category[]>>("/categories");

// User profile
export const updateProfile = (data: { firstName?: string; lastName?: string; phone?: string; bio?: string }) =>
  request<ApiResponse<unknown>>("/users/me", { method: "PATCH", body: data });

export const changePassword = (currentPassword: string, newPassword: string) =>
  request<{ status: string; message: string }>("/users/me/password", {
    method: "PUT",
    body: { currentPassword, newPassword },
  });

export const deleteAccount = () =>
  request<{ status: string; message: string }>("/users/me", { method: "DELETE" });
