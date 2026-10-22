/**
 * API response interfaces — issue #1237
 *
 * `ApiResponse` and `PaginatedResult` are now canonical in `@bluecollar/sdk`
 * (packages/sdk/src/types.ts) so they can be consumed by both packages/api
 * and packages/app without local redefinition.
 *
 * This file re-exports them from the SDK so all existing imports inside
 * packages/api remain unbroken.
 */
export type { ApiResponse, PaginatedResult, Meta } from '@bluecollar/sdk'
