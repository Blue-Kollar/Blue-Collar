/**
 * Unit tests for shared constants (#1898).
 *
 * Verifies that every exported constant has the expected value and type.
 */

import { describe, it, expect } from 'vitest';
import {
  RATE_LIMIT_STRICT_WINDOW_MS,
  RATE_LIMIT_MODERATE_WINDOW_MS,
  RATE_LIMIT_LIBERAL_WINDOW_MS,
  RATE_LIMIT_STRICT_MAX,
  RATE_LIMIT_MODERATE_MAX,
  RATE_LIMIT_LIBERAL_MAX,
  RATE_LIMIT_WRITE_MAX,
  HTTP_STATUS_TOO_MANY_REQUESTS,
  DEFAULT_API_PORT,
  DEFAULT_APP_PORT,
  DEFAULT_MAIL_PORT,
  MAX_FILE_SIZE_BYTES,
  WORKER_SHUTDOWN_TIMEOUT_MS,
  S3_SIGNED_URL_TTL_SECONDS,
  ONE_SECOND_MS,
  ONE_MINUTE_MS,
  ONE_HOUR_MS,
  ONE_DAY_MS,
  FIFTEEN_MINUTES_MS,
} from './constants';

describe('Rate limit constants', () => {
  it('STRICT_WINDOW_MS is 15 minutes', () => {
    expect(RATE_LIMIT_STRICT_WINDOW_MS).toBe(15 * 60 * 1000);
    expect(RATE_LIMIT_STRICT_WINDOW_MS).toBe(FIFTEEN_MINUTES_MS);
  });

  it('MODERATE_WINDOW_MS is 1 hour', () => {
    expect(RATE_LIMIT_MODERATE_WINDOW_MS).toBe(60 * 60 * 1000);
    expect(RATE_LIMIT_MODERATE_WINDOW_MS).toBe(ONE_HOUR_MS);
  });

  it('LIBERAL_WINDOW_MS is 1 hour', () => {
    expect(RATE_LIMIT_LIBERAL_WINDOW_MS).toBe(60 * 60 * 1000);
    expect(RATE_LIMIT_LIBERAL_WINDOW_MS).toBe(ONE_HOUR_MS);
  });

  it('max request counts are positive integers', () => {
    expect(RATE_LIMIT_STRICT_MAX).toBe(5);
    expect(RATE_LIMIT_MODERATE_MAX).toBe(20);
    expect(RATE_LIMIT_LIBERAL_MAX).toBe(100);
    expect(RATE_LIMIT_WRITE_MAX).toBe(10);
  });

  it('HTTP_STATUS_TOO_MANY_REQUESTS is 429', () => {
    expect(HTTP_STATUS_TOO_MANY_REQUESTS).toBe(429);
  });
});

describe('Server / port constants', () => {
  it('DEFAULT_API_PORT is 3000', () => {
    expect(DEFAULT_API_PORT).toBe(3000);
  });

  it('DEFAULT_APP_PORT is 3001', () => {
    expect(DEFAULT_APP_PORT).toBe(3001);
  });

  it('DEFAULT_MAIL_PORT is 587', () => {
    expect(DEFAULT_MAIL_PORT).toBe(587);
  });
});

describe('File upload constants', () => {
  it('MAX_FILE_SIZE_BYTES is 5 MB', () => {
    expect(MAX_FILE_SIZE_BYTES).toBe(5_242_880);
    expect(MAX_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});

describe('Worker constants', () => {
  it('WORKER_SHUTDOWN_TIMEOUT_MS is 30 seconds', () => {
    expect(WORKER_SHUTDOWN_TIMEOUT_MS).toBe(30_000);
  });
});

describe('Storage constants', () => {
  it('S3_SIGNED_URL_TTL_SECONDS is 1 hour', () => {
    expect(S3_SIGNED_URL_TTL_SECONDS).toBe(3600);
  });
});

describe('Time helper constants', () => {
  it('ONE_SECOND_MS is 1000', () => {
    expect(ONE_SECOND_MS).toBe(1000);
  });

  it('ONE_MINUTE_MS is 60 seconds', () => {
    expect(ONE_MINUTE_MS).toBe(60_000);
    expect(ONE_MINUTE_MS).toBe(60 * ONE_SECOND_MS);
  });

  it('ONE_HOUR_MS is 60 minutes', () => {
    expect(ONE_HOUR_MS).toBe(3_600_000);
    expect(ONE_HOUR_MS).toBe(60 * ONE_MINUTE_MS);
  });

  it('ONE_DAY_MS is 24 hours', () => {
    expect(ONE_DAY_MS).toBe(86_400_000);
    expect(ONE_DAY_MS).toBe(24 * ONE_HOUR_MS);
  });

  it('FIFTEEN_MINUTES_MS is 15 minutes', () => {
    expect(FIFTEEN_MINUTES_MS).toBe(900_000);
    expect(FIFTEEN_MINUTES_MS).toBe(15 * ONE_MINUTE_MS);
  });
});

describe('Constants are exported as const (frozen)', () => {
  it('all values are primitive (not objects)', () => {
    const all = [
      RATE_LIMIT_STRICT_WINDOW_MS,
      RATE_LIMIT_MODERATE_WINDOW_MS,
      RATE_LIMIT_LIBERAL_WINDOW_MS,
      RATE_LIMIT_STRICT_MAX,
      RATE_LIMIT_MODERATE_MAX,
      RATE_LIMIT_LIBERAL_MAX,
      RATE_LIMIT_WRITE_MAX,
      HTTP_STATUS_TOO_MANY_REQUESTS,
      DEFAULT_API_PORT,
      DEFAULT_APP_PORT,
      DEFAULT_MAIL_PORT,
      MAX_FILE_SIZE_BYTES,
      WORKER_SHUTDOWN_TIMEOUT_MS,
      S3_SIGNED_URL_TTL_SECONDS,
      ONE_SECOND_MS,
      ONE_MINUTE_MS,
      ONE_HOUR_MS,
      ONE_DAY_MS,
      FIFTEEN_MINUTES_MS,
    ];
    for (const v of all) {
      expect(typeof v).toBe('number');
    }
  });
});
