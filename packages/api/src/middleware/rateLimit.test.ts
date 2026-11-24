import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory fake of the Redis sorted-set operations createRateLimiter relies
// on. Scores are kept so that advancing fake time actually expires old
// requests from the sliding window, with no live Redis instance needed.
const entries = new Map<string, Array<{ score: number; member: string }>>();

vi.mock('../config/redis.js', () => ({
  redis: {
    pipeline: () => {
      const ops: Array<{
        cmd: string;
        key: string;
        score?: number;
        member?: string;
        max?: number;
      }> = [];
      const chain = {
        zremrangebyscore: (key: string, _min: string, max: number) => {
          ops.push({ cmd: 'zremrangebyscore', key, max });
          return chain;
        },
        zadd: (key: string, score: number, member: string) => {
          ops.push({ cmd: 'zadd', key, score, member });
          return chain;
        },
        zcard: (key: string) => {
          ops.push({ cmd: 'zcard', key });
          return chain;
        },
        expire: (key: string) => {
          ops.push({ cmd: 'expire', key });
          return chain;
        },
        exec: async () =>
          ops.map(({ cmd, key, score, member, max }) => {
            if (cmd === 'zremrangebyscore') {
              entries.set(
                key,
                (entries.get(key) ?? []).filter((entry) => entry.score > max!),
              );
            }
            if (cmd === 'zadd') {
              entries.set(key, [...(entries.get(key) ?? []), { score: score!, member: member! }]);
            }
            if (cmd === 'zcard') return [null, entries.get(key)?.length ?? 0];
            return [null, null];
          }),
      };
      return chain;
    },
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
  },
}));

import { redis } from '../config/redis.js';

beforeEach(() => {
  entries.clear();
  vi.mocked(redis.incr).mockResolvedValue(1);
  vi.mocked(redis.expire).mockResolvedValue(1);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createRateLimiter (jobs/disputes/payments mutation endpoints)', () => {
  it('returns a standard 429 response with Retry-After once the threshold is exceeded', async () => {
    const { createRateLimiter } = await import('./rateLimit.js');
    const { JOBS_WRITE } = await import('../config/rateLimits.js');

    // Tiny limit so the test triggers the threshold quickly.
    const tinyLimiter = createRateLimiter({
      ...JOBS_WRITE,
      authLimit: 2,
      burstAllowance: 0,
      windowSec: 60,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as { user: { id: string; role: string } }).user = {
        id: 'u1',
        role: 'worker',
      };
      next();
    });
    app.post('/jobs', tinyLimiter, (_req, res) => res.status(201).json({ status: 'success' }));

    const responses = [];
    for (let i = 0; i < 4; i += 1) {
      responses.push(
        await request(app)
          .post('/jobs')
          .send({ title: `job ${i}` }),
      );
    }

    const limited = responses.find((r) => r.status === 429);
    expect(limited).toBeDefined();
    expect(limited?.body).toMatchObject({ status: 'error', code: 429 });
    expect(limited?.headers['retry-after']).toBeDefined();
  });

  it('allows requests again after the sliding window elapses', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));

    const { createRateLimiter } = await import('./rateLimit.js');
    const { JOBS_WRITE } = await import('../config/rateLimits.js');

    const limiter = createRateLimiter({
      ...JOBS_WRITE,
      authLimit: 1,
      burstAllowance: 0,
      windowSec: 60,
    });

    const app = express();
    app.use((req, _res, next) => {
      (req as unknown as { user: { id: string; role: string } }).user = {
        id: 'u-window',
        role: 'worker',
      };
      next();
    });
    app.post('/jobs', limiter, (_req, res) => res.status(201).json({ status: 'success' }));

    expect((await request(app).post('/jobs')).status).toBe(201);
    expect((await request(app).post('/jobs')).status).toBe(429);

    await vi.advanceTimersByTimeAsync(60_000 + 1); // both requests have left the window
    const allowed = await request(app).post('/jobs');
    expect(allowed.status).toBe(201);
    expect(Number(allowed.headers['ratelimit-remaining'])).toBe(0);
  });
});
