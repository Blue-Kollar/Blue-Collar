import { describe, expect,it } from 'vitest'

import { categorySerializer } from '../serializers/category.serializer.js'
import { serializeError } from '../serializers/error.serializer.js'
import { userSerializer } from '../serializers/user.serializer.js'
import { workerSerializer } from '../serializers/worker.serializer.js'
import { AppError, ErrorCode } from '../utils/AppError.js'

const mockUser: any = {
  id: 'u1', email: 'a@b.com', firstName: 'Jane', lastName: 'Doe',
  role: 'user', verified: true, password: 'secret',
  verificationToken: 'tok', verificationTokenExpiry: new Date(),
  resetToken: 'rst', resetTokenExpiry: new Date(),
  twoFactorSecret: 'sec', twoFactorBackupCodes: ['a'],
  googleId: null, walletAddress: null, avatar: null, bio: null, phone: null,
  referralCode: null, locationId: null, twoFactorEnabled: false,
  createdAt: new Date(), updatedAt: new Date(),
}

const mockCategory: any = {
  id: 'c1', name: 'Plumber', description: null, icon: null,
  createdAt: new Date(), updatedAt: new Date(),
}

const mockWorker: any = {
  id: 'w1', name: 'Bob', bio: null, avatar: null, phone: null, email: null,
  walletAddress: null, isActive: true, isVerified: false, stellarContractId: null,
  searchVector: null, categoryId: 'c1', curatorId: 'u1', locationId: null,
  createdAt: new Date(), updatedAt: new Date(),
  category: mockCategory, curator: mockUser,
}

describe('UserSerializer', () => {
  it('strips sensitive fields', () => {
    const result = userSerializer.serialize(mockUser)
    expect(result).not.toHaveProperty('password')
    expect(result).not.toHaveProperty('verificationToken')
    expect(result).not.toHaveProperty('resetToken')
    expect(result).not.toHaveProperty('twoFactorSecret')
    expect(result).not.toHaveProperty('twoFactorBackupCodes')
    expect(result.email).toBe('a@b.com')
  })

  it('serializes a collection', () => {
    const results = userSerializer.collection([mockUser, mockUser])
    expect(results).toHaveLength(2)
    results.forEach(r => expect(r).not.toHaveProperty('password'))
  })
})

describe('CategorySerializer', () => {
  it('returns expected fields', () => {
    const result = categorySerializer.serialize(mockCategory)
    expect(result).toMatchObject({ id: 'c1', name: 'Plumber' })
  })
})

describe('WorkerSerializer', () => {
  it('strips searchVector and nests relations', () => {
    const result = workerSerializer.serialize(mockWorker)
    expect(result).not.toHaveProperty('searchVector')
    expect(result.category).toMatchObject({ id: 'c1', name: 'Plumber' })
    expect(result.curator).not.toHaveProperty('password')
    expect(result.curator?.email).toBe('a@b.com')
  })
})

describe('ErrorSerializer', () => {
  it('serializes an operational AppError', () => {
    const err = new AppError('Not found', 404, true, ErrorCode.NOT_FOUND)
    const { statusCode, body } = serializeError(err)
    expect(statusCode).toBe(404)
    expect(body.status).toBe('error')
    expect(body.message).toBe('Not found')
    expect(body.errorCode).toBe(ErrorCode.NOT_FOUND)
    expect(body.code).toBe(404)
  })

  it('returns 500 for a non-operational AppError', () => {
    const err = new AppError('Crash', 500, false, ErrorCode.INTERNAL_ERROR)
    const { statusCode, body } = serializeError(err)
    expect(statusCode).toBe(500)
    expect(body.message).toBe('Internal Server Error')
    expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR)
  })

  it('returns 500 for an unknown error', () => {
    const { statusCode, body } = serializeError(new Error('boom'))
    expect(statusCode).toBe(500)
    expect(body.status).toBe('error')
    expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR)
  })

  it('maps Prisma P2002 to 409 CONFLICT', () => {
    const prismaErr = { code: 'P2002', meta: {} }
    const { statusCode, body } = serializeError(prismaErr)
    expect(statusCode).toBe(409)
    expect(body.errorCode).toBe(ErrorCode.CONFLICT)
  })

  it('maps Prisma P2025 to 404 NOT_FOUND', () => {
    const prismaErr = { code: 'P2025' }
    const { statusCode, body } = serializeError(prismaErr)
    expect(statusCode).toBe(404)
    expect(body.errorCode).toBe(ErrorCode.NOT_FOUND)
  })

  it('maps Prisma P2003 to 400 VALIDATION_ERROR', () => {
    const prismaErr = { code: 'P2003' }
    const { statusCode, body } = serializeError(prismaErr)
    expect(statusCode).toBe(400)
    expect(body.errorCode).toBe(ErrorCode.VALIDATION_ERROR)
  })

  it('maps unknown Prisma error to 500', () => {
    const prismaErr = { code: 'P9999' }
    const { statusCode, body } = serializeError(prismaErr)
    expect(statusCode).toBe(500)
    expect(body.errorCode).toBe(ErrorCode.INTERNAL_ERROR)
  })

  it('returns 403 for CORS errors', () => {
    const corsErr = new Error('CORS: origin not allowed')
    const { statusCode, body } = serializeError(corsErr)
    expect(statusCode).toBe(403)
    expect(body.errorCode).toBe(ErrorCode.FORBIDDEN)
  })
})
