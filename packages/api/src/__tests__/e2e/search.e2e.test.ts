/**
 * E2E tests for full-text worker search — issue #1162.
 *
 * search.integration.test.ts already covers the controller/param-passing
 * contract with a mocked search service. This file exercises the real thing:
 * GET /api/workers/search against the real Express app, a real Postgres
 * full-text search (searchVector tsvector column, GIN index, ts_rank), and
 * real filters — asserting an actual query → ranked-results flow, not just
 * a 200 with a mocked payload.
 *
 * Requires a live test database (TEST_DATABASE_URL env var).
 * Database is seeded/cleaned by testSetup.ts.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { db } from '../../db.js';
import app from '../../app.js';

vi.mock('../../mailer/transport.js', () => ({
  transporter: { sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }) },
}));

import { vi } from 'vitest';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function createVerifiedUser(email: string, role: 'user' | 'curator' | 'admin' = 'user') {
  const argon2 = await import('argon2');
  return db.user.create({
    data: {
      email,
      password: await argon2.hash('Password123!'),
      firstName: 'Test',
      lastName: 'User',
      role,
      verified: true,
    },
  });
}

// ── State ─────────────────────────────────────────────────────────────────────
// Search terms deliberately avoid overlap with worker fixtures created by
// sibling e2e test files (they run against the same seeded database).

let plumbingCategoryId: string;
let electricalCategoryId: string;
let curatorId: string;
let heavyMatchWorkerId: string; // "plumberzorp" many times — top rank
let lightMatchWorkerId: string; // "plumberzorp" once, different category
let noMatchWorkerId: string; // shares the category but no text match

describe('Search E2E', () => {
  beforeAll(async () => {
    const plumbing = await db.category.create({ data: { name: 'Plumberzorp Category' } });
    const electrical = await db.category.create({ data: { name: 'Electrical (search e2e)' } });
    plumbingCategoryId = plumbing.id;
    electricalCategoryId = electrical.id;

    const curator = await createVerifiedUser('search-curator@e2e.com', 'curator');
    curatorId = curator.id;

    const heavy = await db.worker.create({
      data: {
        name: 'Alice the Plumberzorp',
        bio: 'Professional plumberzorp offering plumberzorp emergency plumberzorp repairs and plumberzorp inspections.',
        categoryId: plumbingCategoryId,
        curatorId,
        isVerified: true,
      },
    });
    heavyMatchWorkerId = heavy.id;

    const light = await db.worker.create({
      data: {
        name: 'Bob the Electrician',
        bio: 'Occasionally takes plumberzorp referrals when asked.',
        categoryId: electricalCategoryId,
        curatorId,
        isVerified: false,
      },
    });
    lightMatchWorkerId = light.id;

    const none = await db.worker.create({
      data: {
        name: 'Carol the Painter',
        bio: 'Interior and exterior painting specialist. No pipework at all.',
        categoryId: plumbingCategoryId,
        curatorId,
        isVerified: false,
      },
    });
    noMatchWorkerId = none.id;

    await db.review.create({
      data: { workerId: heavyMatchWorkerId, authorId: curatorId, rating: 5, body: 'Fantastic work.' },
    });
    await db.review.create({
      data: { workerId: lightMatchWorkerId, authorId: curatorId, rating: 2, body: 'Not great.' },
    });
  });

  // ── Real ranked full-text search ───────────────────────────────────────────
  describe('GET /api/workers/search?q=... — real ranking', () => {
    it('ranks the worker with denser term matches first, and excludes non-matches entirely', async () => {
      const res = await request(app).get('/api/workers/search?q=plumberzorp');
      expect(res.status).toBe(200);

      const ids = res.body.data.map((w: { id: string }) => w.id);
      expect(ids).toContain(heavyMatchWorkerId);
      expect(ids).toContain(lightMatchWorkerId);
      expect(ids).not.toContain(noMatchWorkerId); // no literal "plumberzorp" token at all

      expect(res.body.data[0].id).toBe(heavyMatchWorkerId);
      const [top, second] = res.body.data;
      expect(typeof top.rank).toBe('number');
      expect(top.rank).toBeGreaterThan(second.rank); // real ts_rank, not a mocked score
    });

    it('returns ts_headline highlights with <mark> around the matched term', async () => {
      const res = await request(app).get('/api/workers/search?q=plumberzorp');
      const top = res.body.data.find((w: { id: string }) => w.id === heavyMatchWorkerId);
      expect(top.highlight.name).toContain('<mark>');
      expect(top.highlight.name.toLowerCase()).toContain('plumberzorp');
    });

    it('applies the category filter on top of the text query', async () => {
      const res = await request(app).get(
        `/api/workers/search?q=plumberzorp&categories=${electricalCategoryId}`,
      );
      expect(res.status).toBe(200);
      const ids = res.body.data.map((w: { id: string }) => w.id);
      expect(ids).toContain(lightMatchWorkerId);
      expect(ids).not.toContain(heavyMatchWorkerId); // right category excluded despite stronger text match
    });

    it('applies the isVerified filter', async () => {
      const res = await request(app).get('/api/workers/search?q=plumberzorp&isVerified=true');
      expect(res.status).toBe(200);
      const ids = res.body.data.map((w: { id: string }) => w.id);
      expect(ids).toEqual([heavyMatchWorkerId]);
    });

    it('applies the minRating filter using real aggregated review data', async () => {
      const res = await request(app).get('/api/workers/search?q=plumberzorp&minRating=4');
      expect(res.status).toBe(200);
      const ids = res.body.data.map((w: { id: string }) => w.id);
      expect(ids).toContain(heavyMatchWorkerId); // avg rating 5
      expect(ids).not.toContain(lightMatchWorkerId); // avg rating 2
    });

    it('paginates results deterministically', async () => {
      const res = await request(app).get('/api/workers/search?q=plumberzorp&limit=1&page=1');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(heavyMatchWorkerId);
      expect(res.body.meta.total).toBe(2);
      expect(res.body.meta.pages).toBe(2);
    });

    it('returns an empty result set for a query matching nothing', async () => {
      const res = await request(app).get('/api/workers/search?q=zzznonexistentqueryzzz');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.total).toBe(0);
    });

    it('browse mode (no query) returns workers without full-text ranking', async () => {
      // Scoped to this file's own categories so results are deterministic
      // regardless of what sibling e2e files have seeded into the shared DB.
      const res = await request(app).get(
        `/api/workers/search?categories=${plumbingCategoryId},${electricalCategoryId}`,
      );
      expect(res.status).toBe(200);
      const ids = res.body.data.map((w: { id: string }) => w.id);
      expect(ids).toContain(heavyMatchWorkerId);
      expect(ids).toContain(noMatchWorkerId);
      expect(res.body.data.every((w: { rank?: number }) => w.rank === 0)).toBe(true);
    });

    it('is publicly accessible without authentication', async () => {
      const res = await request(app).get('/api/workers/search?q=plumberzorp');
      expect(res.status).toBe(200);
    });
  });
});
