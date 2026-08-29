/**
 * E2E tests for the curator listing → admin moderation workflow — issue #1162.
 *
 * Covers the full loop that today only has admin RBAC coverage in
 * admin.integration.test.ts: a curator creates a worker listing
 * (POST /api/workers), and an admin approves or rejects it
 * (PATCH /api/admin/workers/:id/moderate), asserting the resulting
 * isActive/isVerified state and the audit trail it leaves behind.
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

async function loginAs(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  return res.body.token as string;
}

async function createWorkerAsCurator(name: string, token: string, categoryId: string) {
  const res = await request(app)
    .post('/api/workers')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, categoryId, phone: '+15551234567' });
  return res.body.data.id as string;
}

// ── State ─────────────────────────────────────────────────────────────────────

let categoryId: string;
let curatorToken: string;
let userToken: string;
let adminToken: string;
let adminId: string;
let approvedWorkerId: string;
let rejectedWorkerId: string;

describe('Curator Moderation E2E', () => {
  beforeAll(async () => {
    const cat = await db.category.create({ data: { name: 'HVAC Technician' } });
    categoryId = cat.id;

    await createVerifiedUser('moderation-curator@e2e.com', 'curator');
    await createVerifiedUser('moderation-user@e2e.com', 'user');
    const admin = await createVerifiedUser('moderation-admin@e2e.com', 'admin');
    adminId = admin.id;

    curatorToken = await loginAs('moderation-curator@e2e.com');
    userToken = await loginAs('moderation-user@e2e.com');
    adminToken = await loginAs('moderation-admin@e2e.com');
  });

  // ── Curator creates a listing pending moderation ───────────────────────────
  describe('POST /api/workers (curator submits a listing)', () => {
    it('creates a worker as curator, starting isActive=true and isVerified=false', async () => {
      const res = await request(app)
        .post('/api/workers')
        .set('Authorization', `Bearer ${curatorToken}`)
        .send({ name: 'Frosty HVAC Repair', categoryId, phone: '+15551234567' });
      expect(res.status).toBe(201);
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.isVerified).toBe(false);
      approvedWorkerId = res.body.data.id;
    });
  });

  // ── RBAC on the moderation endpoint ────────────────────────────────────────
  describe('PATCH /api/admin/workers/:id/moderate — access control', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app)
        .patch(`/api/admin/workers/${approvedWorkerId}/moderate`)
        .send({ action: 'approve' });
      expect(res.status).toBe(401);
    });

    it("returns 403 for the curator who owns the listing (can't self-moderate)", async () => {
      const res = await request(app)
        .patch(`/api/admin/workers/${approvedWorkerId}/moderate`)
        .set('Authorization', `Bearer ${curatorToken}`)
        .send({ action: 'approve' });
      expect(res.status).toBe(403);
    });

    it('returns 403 for a plain user', async () => {
      const res = await request(app)
        .patch(`/api/admin/workers/${approvedWorkerId}/moderate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ action: 'approve' });
      expect(res.status).toBe(403);
    });
  });

  // ── Approval path ───────────────────────────────────────────────────────────
  describe('PATCH /api/admin/workers/:id/moderate — approve', () => {
    it('rejects an invalid action', async () => {
      const res = await request(app)
        .patch(`/api/admin/workers/${approvedWorkerId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'launch-to-moon' });
      expect(res.status).toBe(400);
    });

    it('returns 404 for a nonexistent worker', async () => {
      const res = await request(app)
        .patch('/api/admin/workers/nonexistent-worker-id/moderate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' });
      expect(res.status).toBe(404);
    });

    it('approves the listing as admin: isActive and isVerified both become true', async () => {
      const res = await request(app)
        .patch(`/api/admin/workers/${approvedWorkerId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve', reason: 'Meets listing standards' });
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(true);
      expect(res.body.data.isVerified).toBe(true);

      const stored = await db.worker.findUnique({ where: { id: approvedWorkerId } });
      expect(stored?.isActive).toBe(true);
      expect(stored?.isVerified).toBe(true);
    });

    it('records an audit log entry for the approval', async () => {
      const entry = await db.auditLog.findFirst({
        where: { resource: 'worker', resourceId: approvedWorkerId, action: 'worker.approve' },
        orderBy: { createdAt: 'desc' },
      });
      expect(entry).toBeDefined();
      expect(entry?.userId).toBe(adminId);
      expect((entry?.meta as unknown as { reason?: string } | null)?.reason).toBe('Meets listing standards');
    });

    it('shows up in GET /api/admin/audit for the admin', async () => {
      const res = await request(app)
        .get('/api/admin/audit')
        .query({ resource: 'worker', action: 'worker.approve' })
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(
        res.body.data.some((entry: { resourceId: string }) => entry.resourceId === approvedWorkerId),
      ).toBe(true);
    });
  });

  // ── Rejection path ──────────────────────────────────────────────────────────
  describe('PATCH /api/admin/workers/:id/moderate — reject', () => {
    beforeAll(async () => {
      rejectedWorkerId = await createWorkerAsCurator('Sketchy Duct Cleaners', curatorToken, categoryId);
    });

    it('rejects the listing as admin: isActive and isVerified both become false', async () => {
      const res = await request(app)
        .patch(`/api/admin/workers/${rejectedWorkerId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'reject', reason: 'Unverifiable business address' });
      expect(res.status).toBe(200);
      expect(res.body.data.isActive).toBe(false);
      expect(res.body.data.isVerified).toBe(false);

      const stored = await db.worker.findUnique({ where: { id: rejectedWorkerId } });
      expect(stored?.isActive).toBe(false);
      expect(stored?.isVerified).toBe(false);
    });

    it('records an audit log entry for the rejection', async () => {
      const entry = await db.auditLog.findFirst({
        where: { resource: 'worker', resourceId: rejectedWorkerId, action: 'worker.reject' },
        orderBy: { createdAt: 'desc' },
      });
      expect(entry).toBeDefined();
      expect(entry?.userId).toBe(adminId);
    });

    it('a rejected listing no longer appears in public search/browse results', async () => {
      const res = await request(app).get('/api/workers');
      expect(res.status).toBe(200);
      expect(
        res.body.data.some((w: { id: string }) => w.id === rejectedWorkerId),
      ).toBe(false);
    });
  });
});
