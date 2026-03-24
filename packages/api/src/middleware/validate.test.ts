import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validate } from './validate.js';
import { Request, Response } from 'express';

describe('validate middleware', () => {
  const mockRes = () => {
    const res: any = {};
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    return res;
  };

  const mockNext = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next if validation passes', () => {
    const rules = { name: 'required|string' };
    const middleware = validate(rules);
    const req = { body: { name: 'John Doe' } } as Request;
    const res = mockRes() as Response;

    middleware(req, res, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 422 with errors if validation fails', () => {
    const rules = { name: 'required|string', email: 'required|email' };
    const middleware = validate(rules);
    const req = { body: { name: 'John Doe' } } as Request; // missing email
    const res = mockRes() as Response;

    middleware(req, res, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        message: 'Validation failed',
        errors: expect.objectContaining({
          email: expect.any(Array),
        }),
      })
    );
  });

  it('handles at least one of (phone/email) correctly with required_without', () => {
    const rules = {
      phone: 'required_without:email',
      email: 'required_without:phone|email',
    };
    const middleware = validate(rules);

    // Both missing -> Fail
    const req1 = { body: {} } as Request;
    const res1 = mockRes() as Response;
    middleware(req1, res1, vi.fn());
    expect(res1.status).toHaveBeenCalledWith(422);

    // Phone present -> Pass
    const req2 = { body: { phone: '123456' } } as Request;
    const res2 = mockRes() as Response;
    const next2 = vi.fn();
    middleware(req2, res2, next2);
    expect(next2).toHaveBeenCalled();

    // Email present -> Pass
    const req3 = { body: { email: 'test@example.com' } } as Request;
    const res3 = mockRes() as Response;
    const next3 = vi.fn();
    middleware(req3, res3, next3);
    expect(next3).toHaveBeenCalled();
  });
});
