import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { verifyToken } from './token-validator.js';

vi.mock('jsonwebtoken', () => ({
  default: { verify: vi.fn() },
}));

vi.mock('../config/env.js', () => ({
  env: { JWT_SECRET: 'test-secret' },
}));

const mockJwt = jwt as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('verifyToken', () => {
  it('calls jwt.verify with the token and secret', () => {
    mockJwt.verify.mockReturnValue({ id: 'u1', role: 'user' });
    verifyToken('my-token');
    expect(mockJwt.verify).toHaveBeenCalledWith('my-token', 'test-secret');
  });

  it('returns the decoded payload', () => {
    const payload = { id: 'u1', role: 'admin' };
    mockJwt.verify.mockReturnValue(payload);
    expect(verifyToken('tok')).toEqual(payload);
  });

  it('throws when jwt.verify throws', () => {
    mockJwt.verify.mockImplementation(() => {
      throw new Error('invalid signature');
    });
    expect(() => verifyToken('bad-token')).toThrow('invalid signature');
  });

  it('throws on expired token', () => {
    mockJwt.verify.mockImplementation(() => {
      const err = new Error('jwt expired');
      (err as any).name = 'TokenExpiredError';
      throw err;
    });
    expect(() => verifyToken('expired')).toThrow('jwt expired');
  });
});
