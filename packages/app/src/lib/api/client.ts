/**
 * Centralized, typed API client used by every API module and page.
 * Attaches the JWT from localStorage, serializes JSON bodies, maps
 * failures to typed errors, and handles 401s by clearing auth state
 * and redirecting to /auth/login.
 */

import { ApiError, HttpError, NetworkError } from '../errors';

export const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api';
export const TOKEN_KEY = 'bc_token';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Skip JSON serialisation — used for FormData uploads */
  rawBody?: BodyInit;
}

/** Build an absolute URL for an API path, tolerating leading slashes. */
export function buildUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = BASE.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function extractMessage(json: unknown, fallback: string): string {
  if (json && typeof json === 'object') {
    const record = json as { message?: unknown; error?: unknown };
    if (typeof record.message === 'string') return record.message;
    if (typeof record.error === 'string') return record.error;
  }
  return fallback;
}

function extractCode(json: unknown): string | undefined {
  if (json && typeof json === 'object') {
    const record = json as { code?: unknown };
    if (typeof record.code === 'string') return record.code;
  }
  return undefined;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, rawBody, headers: extraHeaders, ...rest } = options;

  const token = typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    ...(extraHeaders as Record<string, string>),
  };

  let res: Response;
  try {
    res = await fetch(buildUrl(path), {
      ...rest,
      headers,
      body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (err) {
    throw new NetworkError(err instanceof Error ? err.message : 'Network request failed', err);
  }

  // 401 — clear token and redirect to login
  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/auth/login';
    throw new HttpError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new HttpError(
      extractMessage(json, 'Request failed'),
      res.status,
      extractCode(json),
      json,
    );
  }
  return json as T;
}

/** Convenience helpers bound to the shared request wrapper. */
export const apiClient = {
  request,
  get<T>(path: string, options: RequestOptions = {}) {
    return request<T>(path, { ...options, method: 'GET' });
  },
  post<T>(path: string, body?: unknown, options: RequestOptions = {}) {
    return request<T>(path, { ...options, method: 'POST', body });
  },
  put<T>(path: string, body?: unknown, options: RequestOptions = {}) {
    return request<T>(path, { ...options, method: 'PUT', body });
  },
  patch<T>(path: string, body?: unknown, options: RequestOptions = {}) {
    return request<T>(path, { ...options, method: 'PATCH', body });
  },
  delete<T>(path: string, options: RequestOptions = {}) {
    return request<T>(path, { ...options, method: 'DELETE' });
  },
};

export { ApiError, HttpError, NetworkError };
export default apiClient;
