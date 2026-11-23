/**
 * Barrel export for all constants.
 *
 * Issue #1894: This barrel is intentionally kept — it groups the two constant
 * modules (errors and httpStatus) under a single import path so callers stay
 * decoupled from the internal file layout. Do not add `export *` here for
 * modules that are only used by one caller; use direct imports instead.
 *
 * Import from here to avoid reaching into individual files:
 *   import { HttpStatus, ErrorMessages } from '@/constants/index.js'
 */
export * from './errors.js'
export * from './httpStatus.js'
