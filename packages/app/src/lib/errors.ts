/**
 * Centralised API error parsing into user-facing messages.
 */
import type { ToastType } from "@/hooks/useToast";

export interface ParsedApiError {
  message: string;
  toastType: ToastType;
  code?: string;
  status?: number;
  retryable: boolean;
}

/**
 * Typed error hierarchy used by the centralized API client.
 *
 * All errors thrown by `lib/apiClient.ts` are instances of `ApiError`, so
 * callers can narrow on the concrete subclass (or use the type guards below)
 * instead of inspecting message strings.
 */
export interface ApiErrorOptions {
  code?: string;
  status?: number;
  retryable?: boolean;
  cause?: unknown;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(message: string, options: ApiErrorOptions = {}) {
    super(message);
    this.name = "ApiError";
    this.code = options.code ?? "API_ERROR";
    this.status = options.status;
    this.retryable = options.retryable ?? false;
    this.details = options.details;
    if (options.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    // Restore prototype chain for transpiled targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class HttpError extends ApiError {
  declare readonly status: number;

  constructor(status: number, message?: string, options: Omit<ApiErrorOptions, "status"> = {}) {
    super(message ?? `Request failed with status ${status}`, {
      ...options,
      status,
      code: options.code ?? `HTTP_${status}`,
      retryable: options.retryable ?? (status >= 500 || status === 429),
    });
    this.name = "HttpError";
  }
}

export class NetworkError extends ApiError {
  constructor(message = "Unable to connect. Please check your internet connection.", options: ApiErrorOptions = {}) {
    super(message, {
      ...options,
      code: options.code ?? "NETWORK_ERROR",
      retryable: options.retryable ?? true,
    });
    this.name = "NetworkError";
  }
}

export class ValidationError extends ApiError {
  declare readonly status: number;

  constructor(message = "Please check your input and try again.", options: Omit<ApiErrorOptions, "status"> = {}) {
    super(message, {
      ...options,
      status: 400,
      code: options.code ?? "VALIDATION_ERROR",
      retryable: options.retryable ?? false,
    });
    this.name = "ValidationError";
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Coerces any thrown value into an `ApiError` instance.
 *
 * - `ApiError` instances are returned unchanged.
 * - Native `TypeError`/network failures become `NetworkError`.
 * - Anything else is wrapped in a generic `ApiError`.
 */
export function normalizeError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message ?? "";
    if (
      error.name === "TypeError" ||
      NETWORK_ERRORS.some((e) => message.includes(e))
    ) {
      return new NetworkError(undefined, { cause: error });
    }
    return new ApiError(message || "An unexpected error occurred.", {
      code: "UNKNOWN",
      retryable: true,
      cause: error,
    });
  }

  return new ApiError(typeof error === "string" && error ? error : "An unexpected error occurred.", {
    code: "UNKNOWN",
    retryable: true,
    cause: error,
  });
}

const NETWORK_ERRORS = [
  "Failed to fetch",
  "NetworkError",
  "Network request failed",
  "Load failed",
  "TypeError: Failed to fetch",
  "TypeError: NetworkError",
  "ERR_NETWORK",
  "ERR_CONNECTION_REFUSED",
  "ECONNREFUSED",
  "ERR_INTERNET_DISCONNECTED",
];

const RATE_LIMIT_PATTERNS = [
  "429",
  "Too Many Requests",
  "rate limit",
  "too many requests",
];

export function parseApiError(error: unknown, fallback?: string): ParsedApiError {
  // Typed errors carry structured metadata; prefer it over message sniffing.
  if (error instanceof ApiError) {
    const toastType: ToastType =
      error instanceof ValidationError || error.code === "CONFLICT" || error.code === "RATE_LIMITED"
        ? "warning"
        : "error";
    return {
      message: error.message || fallback || "An unexpected error occurred. Please try again.",
      toastType,
      code: error.code,
      status: error.status,
      retryable: error.retryable,
    };
  }

  const message = error instanceof Error ? error.message : String(error ?? "");

  // Network / connectivity errors
  if (NETWORK_ERRORS.some((e) => message.includes(e))) {
    return {
      message: "Unable to connect. Please check your internet connection.",
      toastType: "error",
      code: "NETWORK_ERROR",
      retryable: true,
    };
  }

  // Rate limiting
  if (RATE_LIMIT_PATTERNS.some((p) => message.includes(p))) {
    return {
      message: "You're doing that too often. Please wait a moment and try again.",
      toastType: "warning",
      code: "RATE_LIMITED",
      retryable: true,
    };
  }

  // Authentication errors
  if (message.includes("401") || message.includes("Unauthorized") || message.includes("Unauthenticated")) {
    return {
      message: "Your session has expired. Please log in again.",
      toastType: "error",
      code: "UNAUTHORIZED",
      status: 401,
      retryable: false,
    };
  }

  // Not found
  if (message.includes("404") || message.includes("Not found") || message.includes("not found")) {
    return {
      message: "The requested resource was not found.",
      toastType: "error",
      code: "NOT_FOUND",
      status: 404,
      retryable: false,
    };
  }

  // Validation / bad request
  if (message.includes("400") || message.includes("Validation") || message.includes("validation")) {
    return {
      message: "Please check your input and try again.",
      toastType: "warning",
      code: "VALIDATION_ERROR",
      status: 400,
      retryable: false,
    };
  }

  // Conflict
  if (message.includes("409") || message.includes("Conflict")) {
    return {
      message: "This action conflicts with the current state. Please refresh and try again.",
      toastType: "warning",
      code: "CONFLICT",
      status: 409,
      retryable: true,
    };
  }

  // Server errors
  if (message.includes("500") || message.includes("Internal Server Error")) {
    return {
      message: "Something went wrong on our end. Please try again later.",
      toastType: "error",
      code: "SERVER_ERROR",
      status: 500,
      retryable: true,
    };
  }

  // Default
  return {
    message: fallback ?? "An unexpected error occurred. Please try again.",
    toastType: "error",
    code: "UNKNOWN",
    retryable: true,
  };
}

export function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.retryable;
  }
  return parseApiError(error).retryable;
}

export function formatErrorMessage(error: unknown, fallback?: string): string {
  return parseApiError(error, fallback).message;
}

/**
 * Maps an HTTP status code to the appropriate typed error.
 * Used by the API client when a response is not ok.
 */
export function errorFromResponse(status: number, message?: string, details?: unknown): ApiError {
  const options: ApiErrorOptions = { details };
  if (status === 400 || status === 422) {
    return new ValidationError(message, options);
  }
  if (status === 401 || status === 403) {
    return new HttpError(status, message ?? "Your session has expired. Please log in again.", {
      ...options,
      code: "UNAUTHORIZED",
      retryable: false,
    });
  }
  if (status === 404) {
    return new HttpError(status, message ?? "The requested resource was not found.", {
      ...options,
      code: "NOT_FOUND",
      retryable: false,
    });
  }
  if (status === 409) {
    return new HttpError(status, message ?? "This action conflicts with the current state. Please refresh and try again.", {
      ...options,
      code: "CONFLICT",
      retryable: true,
    });
  }
  if (status === 429) {
    return new HttpError(status, message ?? "You're doing that too often. Please wait a moment and try again.", {
      ...options,
      code: "RATE_LIMITED",
      retryable: true,
    });
  }
  return new HttpError(status, message, options);
}
