/** Re-export shared types from @bluecollar/types */
export type {
  AccountInfo,
  BroadcastResult,
  TxStatus,
  SdkConfig,
  WorkerRegistration,
  ReputationSync
} from '@bluecollar/types'

// SDK-specific types not shared elsewhere
export interface UnsignedTxParams {
  sourcePublicKey: string;
  destinationPublicKey: string;
  amount: string;
  memo: string;
  sequence: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared API response shapes — issue #1237
//
// Previously ApiResponse and PaginatedResult were independently defined in:
//   packages/api/src/interfaces/response.interface.ts
//   packages/app/src/types/index.ts
// with subtly different field names (PaginatedResult vs PaginatedResponse,
// meta.pages vs meta.totalPages).  Both packages now import from here so
// there is a single source of truth.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pagination metadata included in list responses.
 * Canonical shape: matches the `meta` object produced by all paginated
 * API handlers in packages/api.
 */
export interface Meta {
  total: number
  page: number
  limit: number
  pages: number
}

/**
 * Standard API response envelope returned by every endpoint.
 *
 * - `status`  — `'success'` | `'error'`
 * - `code`    — mirrors the HTTP status code
 * - `message` — human-readable summary (optional on success)
 * - `data`    — typed payload (absent on error responses)
 * - `token`   — JWT token (auth endpoints only)
 * - `meta`    — pagination metadata (list endpoints only)
 */
export interface ApiResponse<T = undefined> {
  status: 'success' | 'error'
  message?: string
  code: number
  data?: T
  token?: string
  meta?: Meta
}

/**
 * Paginated list response — convenience alias for endpoints that always
 * return a page of items with full pagination metadata.
 */
export type PaginatedResult<T> = ApiResponse<T[]> & { meta: Meta }

/**
 * Alias kept for backwards-compatibility with packages/app which previously
 * used `PaginatedResponse`.  New code should use `PaginatedResult`.
 * @deprecated Use `PaginatedResult` instead.
 */
export type PaginatedResponse<T> = PaginatedResult<T>
