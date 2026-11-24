/**
 * The public write limiter answers 429 with Retry-After once the window is full (#1817).
 */

import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { publicWriteRateLimiter } from './rate-limiter';

describe('publicWriteRateLimiter (#1817)', () => {
  it('returns 429 with Retry-After after the window limit is reached', async () => {
    const app = express();
    app.post('/write', publicWriteRateLimiter, (_req, res) => res.json({ ok: true }));

    let limited: request.Response | undefined;
    for (let i = 0; i < 500 && !limited; i++) {
      const res = await request(app).post('/write');
      if (res.status === 429) limited = res;
    }

    expect(limited).toBeDefined();
    expect(limited!.status).toBe(429);
    expect(limited!.headers['retry-after']).toBeDefined();
  });
});
