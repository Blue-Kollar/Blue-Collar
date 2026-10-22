/**
 * Integration tests for admin endpoints and RBAC enforcement.
 * DB/Redis/external deps are mocked; full HTTP cycle via supertest.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import { makeAuthToken } from "../test-harness.js";


// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("../../db.js", () => ({
  db: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    worker: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    category: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(async (ops: any[]) => Promise.all(ops)),
  },
  disconnectDb: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../config/redis.js", async () => (await import("../test-harness.js")).infraMocks.redis());
vi.mock("../../config/env.js", async () => (await import("../test-harness.js")).infraMocks.env());
vi.mock("../../openapi/docs.js", async () => (await import("../test-harness.js")).infraMocks.openapiDocs());
vi.mock("../../config/passport.js", async () => (await import("../test-harness.js")).infraMocks.passport());
vi.mock("../../middleware/requestLogger.js", async () => (await import("../test-harness.js")).infraMocks.requestLogger());
vi.mock("../../queue/index.js", async () => (await import("../test-harness.js")).infraMocks.queue());
vi.mock("../../events/index.js", async () => (await import("../test-harness.js")).infraMocks.events());
vi.mock("../../config/rateLimiter.js", async () => (await import("../test-harness.js")).infraMocks.rateLimiter());
vi.mock("../../middleware/versionRateLimit.js", async () => (await import("../test-harness.js")).infraMocks.versionRateLimit());
vi.mock("../../middleware/userRateLimit.js", async () => (await import("../test-harness.js")).infraMocks.userRateLimit());
vi.mock("../../mailer/transport.js", async () => (await import("../test-harness.js")).infraMocks.mailerTransport());

import app from "../../app.js";
import { db } from "../../db.js";

// ─── Fixtures & helpers ────────────────────────────────────────────────────────

const adminUser = { id: "admin-1", email: "admin@example.com", firstName: "Admin", lastName: "User", role: "admin", verified: true };
const regularUsers = [
  { id: "u1", email: "alice@example.com", firstName: "Alice", lastName: "Smith", role: "user", verified: true, createdAt: new Date(), updatedAt: new Date() },
  { id: "u2", email: "bob@example.com", firstName: "Bob", lastName: "Jones", role: "curator", verified: true, createdAt: new Date(), updatedAt: new Date() },
];

// ─── RBAC matrix for admin endpoints ─────────────────────────────────────────

const protectedAdminEndpoints: Array<{ method: string; path: string }> = [
  { method: "get", path: "/api/admin/users" },
  { method: "get", path: "/api/admin/workers" },
];

describe("Admin endpoints — unauthenticated access is always 401", () => {
  it.each(protectedAdminEndpoints)(
    "GET $path → 401 without token",
    async ({ method, path }) => {
      const res = await (request(app) as any)[method](path);
      expect(res.status).toBe(401);
    }
  );
});

describe("Admin endpoints — USER role gets 403", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({ ...adminUser, role: "user" } as any);
  });

  it.each(protectedAdminEndpoints)(
    "GET $path → 403 for USER",
    async ({ method, path }) => {
      const token = makeAuthToken("user");
      const res = await (request(app) as any)[method](path).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  );
});

describe("Admin endpoints — CURATOR role gets 403", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({ ...adminUser, role: "curator" } as any);
  });

  it.each(protectedAdminEndpoints)(
    "GET $path → 403 for CURATOR",
    async ({ method, path }) => {
      const token = makeAuthToken("curator");
      const res = await (request(app) as any)[method](path).set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(403);
    }
  );
});

// ─── GET /api/admin/users ─────────────────────────────────────────────────────

describe("GET /api/admin/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue(adminUser as any);
    vi.mocked(db.user.findMany).mockResolvedValue(regularUsers as any);
    vi.mocked(db.user.count).mockResolvedValue(2);
  });

  it("returns 200 with paginated user list for ADMIN", async () => {
    const token = makeAuthToken("admin", "admin-1");
    const res = await request(app)
      .get("/api/admin/users")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
  });
});

// ─── GET /api/admin/workers ───────────────────────────────────────────────────

describe("GET /api/admin/workers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue(adminUser as any);
    vi.mocked(db.worker.findMany).mockResolvedValue([] as any);
    vi.mocked(db.worker.count).mockResolvedValue(0);
  });

  it("returns 200 for ADMIN with worker list", async () => {
    const token = makeAuthToken("admin", "admin-1");
    const res = await request(app)
      .get("/api/admin/workers")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});

// ─── PATCH /api/admin/users/:id/role ─────────────────────────────────────────

describe("PATCH /api/admin/users/:id/role — role promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({ ...adminUser, role: "user" } as any);
  });

  it("returns 403 when USER tries to promote another user", async () => {
    const token = makeAuthToken("USER");
    const res = await request(app)
      .patch("/api/admin/users/u1/role")
      .set("Authorization", `Bearer ${token}`)
      .send({ role: "CURATOR" });
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .patch("/api/admin/users/u1/role")
      .send({ role: "CURATOR" });
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/admin/workers/batch — batch operations ────────────────────────

describe("POST /api/admin/workers/batch — RBAC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.user.findUnique).mockResolvedValue({ ...adminUser, role: "user" } as any);
  });

  it("returns 401 when unauthenticated", async () => {
    const res = await request(app)
      .post("/api/admin/workers/batch")
      .send({ action: "activate", ids: ["w1", "w2"] });
    expect(res.status).toBe(401);
  });

  it("returns 403 for USER role", async () => {
    const token = makeAuthToken("USER");
    const res = await request(app)
      .post("/api/admin/workers/batch")
      .set("Authorization", `Bearer ${token}`)
      .send({ action: "activate", ids: ["w1"] });
    expect(res.status).toBe(403);
  });
});
