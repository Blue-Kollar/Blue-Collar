/**
 * E2E tests for the disputes API using Supertest against the real Express app.
 * Requires a live test database (TEST_DATABASE_URL env var).
 * Database is seeded/cleaned by testSetup.ts.
 *
 * Note on scope: `dispute.service.ts` files a dispute against a Worker
 * (workerId + filedById), independent of any Booking/escrow record — the
 * Dispute model has no booking/escrow linkage. So "party to a transaction"
 * authorization (mentioned in issue #938) does not apply to the current
 * implementation: any authenticated user may file a dispute against any
 * worker, and "own disputes" means "disputes I filed" (filedById), not
 * "disputes tied to my bookings". These tests assert the behavior that is
 * actually implemented.
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

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  return res.body.token as string;
}

// ── State ─────────────────────────────────────────────────────────────────────

let workerId: string;
let userAToken: string;
let userAId: string;
let userBToken: string;
let adminToken: string;
let disputeId: string;

describe('Disputes E2E', () => {
  beforeAll(async () => {
    const cat = await db.category.create({ data: { name: 'Plumber' } });
    const curator = await createVerifiedUser('dispute-curator@e2e.com', 'curator');
    const worker = await db.worker.create({
      data: { name: 'Flaky Plumbing Co.', categoryId: cat.id, curatorId: curator.id },
    });
    workerId = worker.id;

    const userA = await createVerifiedUser('dispute-user-a@e2e.com', 'user');
    userAId = userA.id;
    await createVerifiedUser('dispute-user-b@e2e.com', 'user');
    await createVerifiedUser('dispute-admin@e2e.com', 'admin');

    userAToken = await loginAs('dispute-user-a@e2e.com');
    userBToken = await loginAs('dispute-user-b@e2e.com');
    adminToken = await loginAs('dispute-admin@e2e.com');
  });

  // ── File a dispute ──────────────────────────────────────────────────────────
  describe('POST /api/disputes', () => {
    it('files a dispute as an authenticated user and returns 201', async () => {
      const res = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({
          workerId,
          reason: 'No-show for scheduled job',
          evidence: 'Photos of empty driveway',
        });
      expect(res.status).toBe(201);
      expect(res.body.data.workerId).toBe(workerId);
      expect(res.body.data.filedById).toBe(userAId);
      expect(res.body.data.status).toBe('open');
      disputeId = res.body.data.id;
    });

    it('returns 404 for a nonexistent worker', async () => {
      const res = await request(app)
        .post('/api/disputes')
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ workerId: 'nonexistent-worker-id', reason: 'No-show' });
      expect(res.status).toBe(404);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/disputes').send({ workerId, reason: 'No-show' });
      expect(res.status).toBe(401);
    });
  });

  // ── List disputes ────────────────────────────────────────────────────────────
  describe('GET /api/disputes', () => {
    it('returns only the caller-filed disputes for a regular user', async () => {
      const res = await request(app)
        .get('/api/disputes')
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data.every((d: { filedById: string }) => d.filedById === userAId)).toBe(true);
    });

    it("does not include another user's disputes for a regular user", async () => {
      const res = await request(app)
        .get('/api/disputes')
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.find((d: { id: string }) => d.id === disputeId)).toBeUndefined();
    });

    it('returns all disputes for an admin', async () => {
      const res = await request(app)
        .get('/api/disputes')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.find((d: { id: string }) => d.id === disputeId)).toBeDefined();
    });

    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/disputes');
      expect(res.status).toBe(401);
    });
  });

  // ── Get single dispute ───────────────────────────────────────────────────────
  describe('GET /api/disputes/:id', () => {
    it('returns the dispute for the user who filed it', async () => {
      const res = await request(app)
        .get(`/api/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${userAToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(disputeId);
    });

    it('returns 403 for a different, non-admin user', async () => {
      const res = await request(app)
        .get(`/api/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${userBToken}`);
      expect(res.status).toBe(403);
    });

    it('returns the dispute for an admin regardless of who filed it', async () => {
      const res = await request(app)
        .get(`/api/disputes/${disputeId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(disputeId);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await request(app)
        .get('/api/disputes/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ── Resolve dispute (admin only) ────────────────────────────────────────────
  describe('PATCH /api/disputes/:id/resolve', () => {
    it('returns 403 for a non-admin user', async () => {
      const res = await request(app)
        .patch(`/api/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send({ status: 'resolved', resolution: 'Refunded the customer' });
      expect(res.status).toBe(403);
    });

    it('returns 401 without auth', async () => {
      const res = await request(app)
        .patch(`/api/disputes/${disputeId}/resolve`)
        .send({ status: 'resolved' });
      expect(res.status).toBe(401);
    });

    it('resolves the dispute as admin and reaches a terminal status', async () => {
      const res = await request(app)
        .patch(`/api/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'resolved', resolution: 'Refunded the customer' });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('resolved');
      expect(res.body.data.resolution).toBe('Refunded the customer');

      const stored = await db.dispute.findUnique({ where: { id: disputeId } });
      expect(stored?.status).toBe('resolved');
      expect(stored?.resolvedById).toBeDefined();
    });

    it('returns 409 when resolving an already-resolved dispute (no silent double-processing)', async () => {
      const res = await request(app)
        .patch(`/api/disputes/${disputeId}/resolve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'dismissed', resolution: 'Trying to re-resolve' });
      expect(res.status).toBe(409);

      // Status from the first resolution must be untouched.
      const stored = await db.dispute.findUnique({ where: { id: disputeId } });
      expect(stored?.status).toBe('resolved');
    });
  });
});
