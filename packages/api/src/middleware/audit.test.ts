/**
 * Key actions are written to the audit log on success only (#1832).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

const logMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('@/services/audit.service.js', () => ({ log: logMock }));

import { auditMiddleware } from './audit';

function run(opts: {
  method: string;
  path: string;
  statusCode: number;
  body?: unknown;
  user?: { id: string };
}) {
  const req = {
    method: opts.method,
    path: opts.path,
    params: {},
    ip: '127.0.0.1',
    user: opts.user,
  } as unknown as Request;
  const res = {
    statusCode: opts.statusCode,
    json: vi.fn(),
  } as unknown as Response;
  const next = vi.fn();

  auditMiddleware(req, res, next);
  res.json(opts.body ?? {});
  return { next };
}

describe('auditMiddleware (#1832)', () => {
  beforeEach(() => {
    logMock.mockClear();
  });

  it('logs a successful login with the mapped action and user', () => {
    run({ method: 'POST', path: '/api/auth/login', statusCode: 200, user: { id: 'user-1' } });

    expect(logMock).toHaveBeenCalledTimes(1);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login', resource: 'User', userId: 'user-1' }),
    );
  });

  it('logs a successful admin moderation with the resource id from the path', () => {
    const req = {
      method: 'PATCH',
      path: '/api/admin/workers/w-9/moderate',
      params: { id: 'w-9' },
      ip: '127.0.0.1',
      user: { id: 'admin-1' },
    } as unknown as Request;
    const res = { statusCode: 200, json: vi.fn() } as unknown as Response;

    auditMiddleware(req, res, vi.fn());
    res.json({});

    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'worker.moderate', resource: 'worker', resourceId: 'w-9' }),
    );
  });

  it('does not log a failed request', () => {
    run({ method: 'DELETE', path: '/api/workers/w-1', statusCode: 500 });

    expect(logMock).not.toHaveBeenCalled();
  });

  it('passes through routes that are not audited', () => {
    const { next } = run({ method: 'GET', path: '/api/workers', statusCode: 200 });

    expect(next).toHaveBeenCalled();
    expect(logMock).not.toHaveBeenCalled();
  });
});
