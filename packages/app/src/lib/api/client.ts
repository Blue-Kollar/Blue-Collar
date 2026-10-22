/**
 * Shared HTTP request wrapper used by every API client module.
 * Attaches the JWT from localStorage, serializes JSON bodies, and
 * handles 401s by clearing auth state and redirecting to /auth/login.
 */

export const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
export const TOKEN_KEY = "bc_token";

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip JSON serialisation — used for FormData uploads */
  rawBody?: BodyInit;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
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
