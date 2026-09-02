/**
 * #1291 — Consolidated response types.
 *
 * ApiResponse and PaginatedResult were duplicated here; the canonical
 * definitions now live in @bluecollar/types.  This file is kept so that
 * existing internal imports (../interfaces) continue to resolve without
 * touching every consumer.
 */
export type { ApiResponse, PaginatedResult } from '@bluecollar/types'
