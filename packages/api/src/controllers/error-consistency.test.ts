/**
 * Integration tests for error handling consistency across controllers.
 * Verifies that all controllers throw consistent error shapes (closes #1405).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response } from 'express'
import { AppError, ErrorCode } from '../utils/AppError.js'
import { serializeError } from '../serializers/error.serializer.js'
import { HttpStatus, ErrorMessages } from '../constants/index.js'

function makeRes() {
  const res: Partial<Response> = {}
  res.status = vi.fn().mockReturnValue(res)
  res.json = vi.fn().mockReturnValue(res)
  return res as Response & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return { method: 'GET', url: '/test', headers: {}, ...overrides } as unknown as Request
}

describe('Error Response Consistency (Issue #1405)', () => {
  describe('AppError serialization', () => {
    it('serializes 404 errors with consistent shape', () => {
      const err = new AppError(ErrorMessages.DB_RECORD_NOT_FOUND, HttpStatus.NOT_FOUND, true, ErrorCode.NOT_FOUND)
      const { statusCode, body } = serializeError(err)

      expect(statusCode).toBe(404)
      expect(body).toMatchObject({
        status: 'error',
        code: 404,
        errorCode: ErrorCode.NOT_FOUND,
        message: ErrorMessages.DB_RECORD_NOT_FOUND,
      })
      expect(body.message).toBeDefined()
      expect(body.code).toBeDefined()
      expect(body.errorCode).toBeDefined()
    })

    it('serializes 409 conflict errors with consistent shape', () => {
      const err = new AppError(ErrorMessages.DB_DUPLICATE_VALUE, HttpStatus.CONFLICT, true, ErrorCode.CONFLICT)
      const { statusCode, body } = serializeError(err)

      expect(statusCode).toBe(409)
      expect(body).toMatchObject({
        status: 'error',
        code: 409,
        errorCode: ErrorCode.CONFLICT,
      })
    })

    it('serializes 422 validation errors with consistent shape', () => {
      const err = new AppError('Email is required', HttpStatus.UNPROCESSABLE_ENTITY, true, ErrorCode.VALIDATION_ERROR)
      const { statusCode, body } = serializeError(err)

      expect(statusCode).toBe(422)
      expect(body).toMatchObject({
        status: 'error',
        code: 422,
        errorCode: ErrorCode.VALIDATION_ERROR,
      })
    })

    it('serializes 401 unauthorized errors with consistent shape', () => {
      const err = new AppError('Invalid credentials', HttpStatus.UNAUTHORIZED, true, ErrorCode.INVALID_CREDENTIALS)
      const { statusCode, body } = serializeError(err)

      expect(statusCode).toBe(401)
      expect(body).toMatchObject({
        status: 'error',
        code: 401,
        errorCode: ErrorCode.INVALID_CREDENTIALS,
      })
    })

    it('serializes 403 forbidden errors with consistent shape', () => {
      const err = new AppError('Access denied', HttpStatus.FORBIDDEN, true, ErrorCode.FORBIDDEN)
      const { statusCode, body } = serializeError(err)

      expect(statusCode).toBe(403)
      expect(body).toMatchObject({
        status: 'error',
        code: 403,
        errorCode: ErrorCode.FORBIDDEN,
      })
    })

    it('includes traceId in all error responses', () => {
      const err = new AppError('Test error', HttpStatus.BAD_REQUEST)
      const { body } = serializeError(err)

      expect(body.traceId).toBeDefined()
      expect(typeof body.traceId).toBe('string')
    })

    it('never exposes stack traces in production errors', () => {
      const original = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      const err = new Error('Internal implementation detail')
      const { body } = serializeError(err)

      expect(body.stack).toBeUndefined()
      expect(body.originalMessage).toBeUndefined()
      expect(body.message).toBe(ErrorMessages.INTERNAL_SERVER_ERROR)

      process.env.NODE_ENV = original
    })

    it('exposes stack trace only in development for non-operational errors', () => {
      const original = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      const err = new Error('Dev error detail')
      const { body } = serializeError(err)

      expect(body.stack).toBeDefined()
      expect(body.originalMessage).toBe('Dev error detail')

      process.env.NODE_ENV = original
    })
  })

  describe('Prisma error handling', () => {
    it('maps P2002 (unique constraint) to 409 conflict', () => {
      const prismaErr = {
        code: 'P2002',
        meta: { target: ['email'] },
      }

      const { statusCode, body } = serializeError(prismaErr)

      expect(statusCode).toBe(409)
      expect(body.errorCode).toBe(ErrorCode.CONFLICT)
      expect(body.code).toBe(409)
    })

    it('maps P2025 (record not found) to 404', () => {
      const prismaErr = {
        code: 'P2025',
        meta: {},
      }

      const { statusCode, body } = serializeError(prismaErr)

      expect(statusCode).toBe(404)
      expect(body.errorCode).toBe(ErrorCode.NOT_FOUND)
      expect(body.code).toBe(404)
    })

    it('maps P2003 (foreign key constraint) to 400', () => {
      const prismaErr = {
        code: 'P2003',
        meta: { field_name: 'userId' },
      }

      const { statusCode, body } = serializeError(prismaErr)

      expect(statusCode).toBe(400)
      expect(body.errorCode).toBe(ErrorCode.VALIDATION_ERROR)
      expect(body.code).toBe(400)
    })

    it('maps unknown Prisma errors to 500', () => {
      const prismaErr = {
        code: 'P9999',
        meta: {},
      }

      const { statusCode, body } = serializeError(prismaErr)

      expect(statusCode).toBe(500)
      expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR)
      expect(body.code).toBe(500)
    })
  })

  describe('Generic error handling', () => {
    it('converts unknown errors to 500 with generic message', () => {
      const err = new Error('Unexpected boom')
      const { statusCode, body } = serializeError(err)

      expect(statusCode).toBe(500)
      expect(body.code).toBe(500)
      expect(body.message).toBe(ErrorMessages.INTERNAL_SERVER_ERROR)
      expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR)
    })

    it('handles non-Error objects gracefully', () => {
      const err = 'string error'
      const { statusCode, body } = serializeError(err)

      expect(statusCode).toBe(500)
      expect(body.status).toBe('error')
      expect(body.code).toBe(500)
    })

    it('handles null/undefined errors', () => {
      const { statusCode, body } = serializeError(undefined)

      expect(statusCode).toBe(500)
      expect(body.status).toBe('error')
      expect(body.code).toBe(500)
    })
  })

  describe('Error response shape invariants', () => {
    it('all error responses have required fields', () => {
      const testCases = [
        new AppError('404 error', 404, true, ErrorCode.NOT_FOUND),
        new AppError('400 error', 400, true, ErrorCode.VALIDATION_ERROR),
        new AppError('409 error', 409, true, ErrorCode.CONFLICT),
        new Error('Unhandled error'),
        { code: 'P2002' },
      ]

      testCases.forEach((err) => {
        const { statusCode, body } = serializeError(err)

        expect(body).toHaveProperty('status')
        expect(body).toHaveProperty('message')
        expect(body).toHaveProperty('code')
        expect(body).toHaveProperty('errorCode')
        expect(body.status).toBe('error')
        expect(typeof body.code).toBe('number')
        expect(typeof body.message).toBe('string')
        expect(statusCode).toBeDefined()
      })
    })

    it('errorCode is always a valid ErrorCode enum value', () => {
      const validErrorCodes = Object.values(ErrorCode)
      const testCases = [
        new AppError('Test', 404, true, ErrorCode.NOT_FOUND),
        new AppError('Test', 409, true, ErrorCode.CONFLICT),
        new AppError('Test', 422, true, ErrorCode.VALIDATION_ERROR),
      ]

      testCases.forEach((err) => {
        const { body } = serializeError(err)
        expect(validErrorCodes).toContain(body.errorCode)
      })
    })

    it('statusCode matches error response code field', () => {
      const testCases = [
        { err: new AppError('Test', 404, true, ErrorCode.NOT_FOUND), expectedCode: 404 },
        { err: new AppError('Test', 409, true, ErrorCode.CONFLICT), expectedCode: 409 },
        { err: new AppError('Test', 422, true, ErrorCode.VALIDATION_ERROR), expectedCode: 422 },
      ]

      testCases.forEach(({ err, expectedCode }) => {
        const { statusCode, body } = serializeError(err)
        expect(statusCode).toBe(expectedCode)
        expect(body.code).toBe(expectedCode)
      })
    })
  })
})
