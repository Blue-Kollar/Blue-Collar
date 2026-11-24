/**
 * Shared harness for controller error-path tests (issue #1872).
 *
 * Runs a controller handler, captures the error it forwards to `next()`, and
 * feeds that error through the real central `errorHandler` middleware. This
 * lets each test assert the exact JSON envelope clients receive, not just
 * the status code on the thrown AppError.
 */
import { expect, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { errorHandler } from '../../middleware/errorHandler.js';
import type { ErrorEnvelope } from '../../middleware/errorHandler.js';
import { makeNext, makeReq, makeRes } from './testHarness.js';

export const ERROR_TRACE_ID = 'req-error-path-test';

export interface CapturedError {
  status: number;
  body: ErrorEnvelope;
  error: unknown;
}

type Handler = (req: Request, res: Response, next: NextFunction) => unknown;

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

/** Run a catchAsync-wrapped (or plain) handler and capture its forwarded error. */
export async function captureHandlerError(
  handler: Handler,
  overrides: Partial<Request> = {},
): Promise<CapturedError> {
  const req = makeReq({
    ...overrides,
    headers: { 'x-request-id': ERROR_TRACE_ID },
  } as never) as unknown as Request;
  const res = makeRes();
  const next = makeNext();
  let forwarded: unknown;
  next.mockImplementation(((err?: unknown) => {
    if (err !== undefined) forwarded = err;
  }) as unknown as typeof next);

  await handler(req, res as unknown as Response, next as unknown as NextFunction);
  await flush();

  expect(forwarded, 'handler must forward an error to next()').toBeDefined();

  return serializeError(forwarded, req);
}

/** Serialize an error through the real errorHandler and return its envelope. */
export function serializeError(err: unknown, overrides: Partial<Request> = {}): CapturedError {
  const req = makeReq({
    ...overrides,
    headers: { 'x-request-id': ERROR_TRACE_ID },
  } as never) as unknown as Request;
  const res = makeRes();
  const next = makeNext();

  errorHandler(err, req, res as unknown as Response, next as unknown as NextFunction);

  const status = res.status.mock.calls[0]?.[0] as number;
  const body = res.json.mock.calls[0]?.[0] as ErrorEnvelope;
  expect(status, 'errorHandler must call res.status()').toBeDefined();
  expect(body, 'errorHandler must call res.json()').toBeDefined();
  return { status, body, error: err };
}

/** Assert the complete error envelope produced by errorHandler. */
export function expectErrorEnvelope(
  captured: CapturedError,
  expected: Pick<ErrorEnvelope, 'message' | 'code' | 'errorCode'> & { details?: unknown },
): void {
  expect(captured.status).toBe(expected.code);
  expect(captured.body).toStrictEqual({
    status: 'error',
    message: expected.message,
    code: expected.code,
    errorCode: expected.errorCode,
    traceId: ERROR_TRACE_ID,
    ...(expected.details === undefined ? {} : { details: expected.details }),
  });
}

export { makeNext, makeReq, makeRes, vi };
