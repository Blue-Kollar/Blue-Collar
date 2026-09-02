/**
 * Guards docs/ERROR_HANDLING_AND_LOGGING.md against drift.
 *
 * The conventions doc makes concrete, checkable claims about the error envelope,
 * the ErrorCode enum, and the traceId contract. Documentation that silently goes
 * stale is worse than none, so each claim is asserted here against the real code.
 * If this fails, either the code changed and the doc needs updating, or vice versa.
 *
 * Also guards the cross-layer naming convention: the doc must explain both the
 * API-layer ErrorCode and the contract-layer ContractError, and must keep their
 * sections present so future contributors understand why the names differ.
 */

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ErrorCode } from '../utils/AppError.js'
import { AppError } from '../utils/AppError.js'
import { serializeError } from '../serializers/error.serializer.js'
import { HttpStatus } from '../constants/index.js'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(HERE, '../../../..')
const DOC_PATH = path.join(REPO_ROOT, 'docs/ERROR_HANDLING_AND_LOGGING.md')
const CONTRIBUTING_PATH = path.join(REPO_ROOT, 'CONTRIBUTING.md')

const doc = fs.readFileSync(DOC_PATH, 'utf8')

/** Envelope fields the doc promises are always present on an error response. */
const REQUIRED_ENVELOPE_FIELDS = ['status', 'message', 'code', 'errorCode'] as const

/** Log levels the doc's level table must cover. */
const DOCUMENTED_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const

describe('error handling conventions doc', () => {
  it('exists and is referenced from CONTRIBUTING.md', () => {
    expect(fs.existsSync(DOC_PATH)).toBe(true)
    const contributing = fs.readFileSync(CONTRIBUTING_PATH, 'utf8')
    expect(contributing).toContain('docs/ERROR_HANDLING_AND_LOGGING.md')
  })

  it('documents every ErrorCode member', () => {
    const undocumented = Object.values(ErrorCode).filter((code) => !doc.includes(code))
    expect(undocumented, `ErrorCode members missing from ${path.basename(DOC_PATH)}`).toEqual([])
  })

  it('does not document ErrorCode members that no longer exist', () => {
    // Pull every SCREAMING_SNAKE token out of the doc's ErrorCode table rows and
    // check each against the enum, so removing a code fails the doc too.
    const tableRow = /^\|\s*(?:Auth|Resource|Validation|Server)\s*\|(.+)\|$/gm
    const claimed = new Set<string>()
    for (const [, cell] of doc.matchAll(tableRow)) {
      for (const [, token] of cell.matchAll(/`([A-Z][A-Z_]+)`/g)) claimed.add(token)
    }
    expect(claimed.size).toBeGreaterThan(0)

    const known = new Set<string>(Object.values(ErrorCode))
    const stale = [...claimed].filter((code) => !known.has(code))
    expect(stale, 'doc lists ErrorCode members that no longer exist').toEqual([])
  })

  it('documents all six pino log levels', () => {
    const missing = DOCUMENTED_LEVELS.filter((level) => !doc.includes(`\`${level}\``))
    expect(missing, 'log levels missing from the level table').toEqual([])
  })

  it('documents correlation ID propagation via getTraceId', () => {
    expect(doc).toContain('getTraceId()')
    expect(doc).toContain('traceparent')
  })

  it('provides before/after examples', () => {
    expect(doc).toMatch(/\*\*Before\*\*/)
    expect(doc).toMatch(/\*\*After\*\*/)
  })

  // ── Cross-layer naming convention guards ─────────────────────────────────
  // The doc explains that ErrorCode (API layer) and ContractError (contract layer)
  // are intentionally named differently. These tests ensure that explanation stays
  // present and accurate so the convention is never silently removed.

  it('documents the ContractError naming convention section', () => {
    expect(
      doc,
      'Missing "Contract errors" section — the doc must explain the ErrorCode vs ContractError naming rationale',
    ).toContain('## Contract errors (Rust / Soroban)')
  })

  it('documents the naming convention rationale table with both error types', () => {
    expect(doc, 'Doc must reference the ErrorCode enum in the cross-layer table').toContain(
      '`ErrorCode` enum',
    )
    expect(doc, 'Doc must reference the ContractError enum in the cross-layer table').toContain(
      '`ContractError` enum',
    )
  })

  it('documents the rule against introducing a third error enum', () => {
    expect(doc).toContain('Do not rename either enum or introduce a third error enum')
  })

  it('documents where ContractError codes are centralised', () => {
    expect(doc).toContain('packages/contracts/contracts/types/src/errors.rs')
  })

  it('documents how the API surfaces contract errors', () => {
    expect(doc).toContain('How the API surfaces contract errors')
    expect(doc).toContain('Map **at the service boundary**')
  })
})

describe('documented error envelope matches serializeError', () => {
  it('emits every required field for an operational AppError', () => {
    const { statusCode, body } = serializeError(
      new AppError('Worker not found', HttpStatus.NOT_FOUND, true, ErrorCode.NOT_FOUND),
    )

    expect(statusCode).toBe(HttpStatus.NOT_FOUND)
    for (const field of REQUIRED_ENVELOPE_FIELDS) {
      expect(body, `missing documented envelope field "${field}"`).toHaveProperty(field)
    }
    expect(body.status).toBe('error')
    expect(body.code).toBe(statusCode)
    expect(body.errorCode).toBe(ErrorCode.NOT_FOUND)
  })

  it('emits every required field for an unexpected error', () => {
    const { statusCode, body } = serializeError(new Error('boom'))

    expect(statusCode).toBe(HttpStatus.INTERNAL_SERVER_ERROR)
    for (const field of REQUIRED_ENVELOPE_FIELDS) {
      expect(body, `missing documented envelope field "${field}"`).toHaveProperty(field)
    }
    expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR)
    // The doc promises internal detail is never leaked to the client.
    expect(body.message).not.toContain('boom')
  })

  it('maps Prisma error codes as documented', () => {
    // The doc's status-mapping table claims P2002 -> 409 CONFLICT,
    // P2025 -> 404 NOT_FOUND, P2003 -> 400 VALIDATION_ERROR.
    const cases = [
      { code: 'P2002', status: HttpStatus.CONFLICT, errorCode: ErrorCode.CONFLICT },
      { code: 'P2025', status: HttpStatus.NOT_FOUND, errorCode: ErrorCode.NOT_FOUND },
      { code: 'P2003', status: HttpStatus.BAD_REQUEST, errorCode: ErrorCode.VALIDATION_ERROR },
    ]

    for (const { code, status, errorCode } of cases) {
      const { statusCode, body } = serializeError({ code })
      expect(statusCode, `${code} status`).toBe(status)
      expect(body.errorCode, `${code} errorCode`).toBe(errorCode)
    }
  })

  it('omits traceId rather than emitting null when no span is active', () => {
    // The doc tells clients to treat traceId as optional-and-absent, not nullable.
    const { body } = serializeError(new AppError('nope', 404, true, ErrorCode.NOT_FOUND))
    expect(body.traceId ?? undefined).toBeUndefined()
    expect(body.traceId).not.toBeNull()
  })

  it('does not leak stack traces outside development', () => {
    const original = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const { body } = serializeError(new Error('internal detail'))
      expect(body.stack).toBeUndefined()
      expect(body.originalMessage).toBeUndefined()
    } finally {
      process.env.NODE_ENV = original
    }
  })
})
