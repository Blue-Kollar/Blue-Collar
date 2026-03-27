import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validate } from './validate.js'
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
  verifyAccountRules,
} from '../validations/auth.js'
import { createWorkerRules } from '../validations/worker.js'
import { Request, Response } from 'express'

describe('validate middleware', () => {
  const mockRes = () => {
    const res: any = {}
    res.status = vi.fn().mockReturnValue(res)
    res.json = vi.fn().mockReturnValue(res)
    return res
  }

  const mockNext = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── General Middleware Tests ──────────────────────────────────────────────

  describe('general middleware behavior', () => {
    it('calls next if validation passes', () => {
      const rules = { name: 'required|string' }
      const middleware = validate(rules)
      const req = { body: { name: 'John Doe' } } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(mockNext).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('returns 422 with errors if validation fails', () => {
      const rules = { name: 'required|string', email: 'required|email' }
      const middleware = validate(rules)
      const req = { body: { name: 'John Doe' } } as Request // missing email
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          message: 'Validation failed',
          code: 422,
          errors: expect.objectContaining({
            email: expect.any(Array),
          }),
        })
      )
    })

    it('returns structured error response with all error details', () => {
      const rules = { email: 'required|email', password: 'required|min:8' }
      const middleware = validate(rules)
      const req = { body: { email: 'invalid-email', password: 'short' } } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
      const jsonCall = res.json.mock.calls[0][0]
      expect(jsonCall).toHaveProperty('status', 'error')
      expect(jsonCall).toHaveProperty('message', 'Validation failed')
      expect(jsonCall).toHaveProperty('code', 422)
      expect(jsonCall).toHaveProperty('errors')
    })

    it('does not call next when validation fails', () => {
      const rules = { name: 'required' }
      const middleware = validate(rules)
      const req = { body: {} } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
    })
  })

  // ── Register Validation Tests ─────────────────────────────────────────────

  describe('registerRules validation', () => {
    it('passes with valid register data', () => {
      const middleware = validate(registerRules)
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.status).not.toHaveBeenCalled()
    })

    it('fails when email is missing', () => {
      const middleware = validate(registerRules)
      const req = {
        body: {
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.objectContaining({
            email: expect.any(Array),
          }),
        })
      )
    })

    it('fails when email is invalid', () => {
      const middleware = validate(registerRules)
      const req = {
        body: {
          email: 'invalid-email',
          password: 'password123',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('fails when password is less than 8 characters', () => {
      const middleware = validate(registerRules)
      const req = {
        body: {
          email: 'user@example.com',
          password: 'short',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.objectContaining({
            password: expect.any(Array),
          }),
        })
      )
    })

    it('fails when firstName is missing', () => {
      const middleware = validate(registerRules)
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password123',
          lastName: 'Doe',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('fails when lastName is missing', () => {
      const middleware = validate(registerRules)
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password123',
          firstName: 'John',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('passes with exactly 8 character password', () => {
      const middleware = validate(registerRules)
      const req = {
        body: {
          email: 'user@example.com',
          password: '12345678',
          firstName: 'John',
          lastName: 'Doe',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
    })
  })

  // ── Login Validation Tests ────────────────────────────────────────────────

  describe('loginRules validation', () => {
    it('passes with valid login data', () => {
      const middleware = validate(loginRules)
      const req = {
        body: {
          email: 'user@example.com',
          password: 'password123',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('fails when email is missing', () => {
      const middleware = validate(loginRules)
      const req = {
        body: {
          password: 'password123',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('fails when email is invalid', () => {
      const middleware = validate(loginRules)
      const req = {
        body: {
          email: 'invalid-email',
          password: 'password123',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('fails when password is missing', () => {
      const middleware = validate(loginRules)
      const req = {
        body: {
          email: 'user@example.com',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('passes with any password length', () => {
      const middleware = validate(loginRules)
      const req = {
        body: {
          email: 'user@example.com',
          password: 'a',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
    })
  })

  // ── Forgot Password Validation Tests ──────────────────────────────────────

  describe('forgotPasswordRules validation', () => {
    it('passes with valid email', () => {
      const middleware = validate(forgotPasswordRules)
      const req = {
        body: {
          email: 'user@example.com',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('fails when email is missing', () => {
      const middleware = validate(forgotPasswordRules)
      const req = { body: {} } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('fails when email is invalid', () => {
      const middleware = validate(forgotPasswordRules)
      const req = {
        body: {
          email: 'invalid-email',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })
  })

  // ── Reset Password Validation Tests ───────────────────────────────────────

  describe('resetPasswordRules validation', () => {
    it('passes with valid reset password data', () => {
      const middleware = validate(resetPasswordRules)
      const req = {
        body: {
          token: 'abc123def456',
          password: 'newpassword123',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('fails when token is missing', () => {
      const middleware = validate(resetPasswordRules)
      const req = {
        body: {
          password: 'newpassword123',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('fails when password is missing', () => {
      const middleware = validate(resetPasswordRules)
      const req = {
        body: {
          token: 'abc123def456',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('fails when password is less than 8 characters', () => {
      const middleware = validate(resetPasswordRules)
      const req = {
        body: {
          token: 'abc123def456',
          password: 'short',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })
  })

  // ── Verify Account Validation Tests ───────────────────────────────────────

  describe('verifyAccountRules validation', () => {
    it('passes with valid token', () => {
      const middleware = validate(verifyAccountRules)
      const req = {
        body: {
          token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('fails when token is missing', () => {
      const middleware = validate(verifyAccountRules)
      const req = { body: {} } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })
  })

  // ── Create Worker Validation Tests ────────────────────────────────────────

  describe('createWorkerRules validation', () => {
    it('passes with name, categoryId, and phone', () => {
      const middleware = validate(createWorkerRules)
      const req = {
        body: {
          name: 'John Plumber',
          categoryId: 'cat-123',
          phone: '555-1234',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('passes with name, categoryId, and email', () => {
      const middleware = validate(createWorkerRules)
      const req = {
        body: {
          name: 'John Plumber',
          categoryId: 'cat-123',
          email: 'john@example.com',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('passes with name, categoryId, phone, and email', () => {
      const middleware = validate(createWorkerRules)
      const req = {
        body: {
          name: 'John Plumber',
          categoryId: 'cat-123',
          phone: '555-1234',
          email: 'john@example.com',
        },
      } as Request
      const res = mockRes() as Response
      const next = vi.fn()

      middleware(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('fails when name is missing', () => {
      const middleware = validate(createWorkerRules)
      const req = {
        body: {
          categoryId: 'cat-123',
          phone: '555-1234',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('fails when categoryId is missing', () => {
      const middleware = validate(createWorkerRules)
      const req = {
        body: {
          name: 'John Plumber',
          phone: '555-1234',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })

    it('fails when both phone and email are missing', () => {
      const middleware = validate(createWorkerRules)
      const req = {
        body: {
          name: 'John Plumber',
          categoryId: 'cat-123',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: expect.any(Object),
        })
      )
    })

    it('fails when email is invalid', () => {
      const middleware = validate(createWorkerRules)
      const req = {
        body: {
          name: 'John Plumber',
          categoryId: 'cat-123',
          email: 'invalid-email',
        },
      } as Request
      const res = mockRes() as Response

      middleware(req, res, mockNext)

      expect(res.status).toHaveBeenCalledWith(422)
    })
  })
})
